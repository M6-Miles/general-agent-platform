"""Agent lifecycle endpoints."""

import hashlib
import json
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.audit import record_audit
from app.db import get_db
from app.dependencies import Principal, require_permission
from app.idempotency import persist_response, replay_or_reject, request_hash
from app.models import Agent, AgentVersion
from app.schemas import AgentCreate, AgentOut, AgentRollback, AgentUpdate, AgentVersionOut

router = APIRouter(prefix="/api/v1/agents", tags=["agents"])


def _cursor(value: str | None) -> tuple[str, str] | None:
    from app.main import _decode_cursor
    return _decode_cursor(value)


def _next_cursor(value: str, item_id: str) -> str:
    from app.main import _encode_cursor
    return _encode_cursor(value, item_id)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_agent(payload: AgentCreate, request: Request, principal: Principal = Depends(require_permission("agent:write")), db: Session = Depends(get_db)):
    idempotency_key = request.headers.get("Idempotency-Key")
    fingerprint = request_hash(request, payload.model_dump(mode="json"))
    replay = replay_or_reject(db, tenant_id=principal.tenant_id, key=idempotency_key, fingerprint=fingerprint)
    if replay is not None:
        return replay
    agent = Agent(tenant_id=principal.tenant_id, name=payload.name, definition=payload.definition, created_by=principal.user_id, updated_by=principal.user_id)
    db.add(agent)
    try:
        db.flush()
        record_audit(db, tenant_id=principal.tenant_id, actor_id=principal.user_id, action="agent.created", resource_type="agent", resource_id=agent.id, request_id=request.state.request_id)
        response = {"data": AgentOut.model_validate(agent).model_dump(mode="json"), "request_id": request.state.request_id}
        persist_response(db, tenant_id=principal.tenant_id, key=idempotency_key, fingerprint=fingerprint, response_status=201, response_json=response, resource_type="agent", resource_id=agent.id)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        replay = replay_or_reject(db, tenant_id=principal.tenant_id, key=idempotency_key, fingerprint=fingerprint)
        if replay is not None:
            return replay
        raise HTTPException(status_code=409, detail="CONFLICT") from exc
    db.refresh(agent)
    return response


@router.get("")
def list_agents(request: Request, limit: int = Query(default=100, ge=1, le=100), cursor: str | None = None, principal: Principal = Depends(require_permission("agent:read")), db: Session = Depends(get_db)):
    query = db.query(Agent).filter(Agent.tenant_id == principal.tenant_id, Agent.deleted_at.is_(None))
    decoded = _cursor(cursor)
    if decoded:
        value, item_id = decoded
        timestamp = datetime.fromisoformat(value)
        query = query.filter((Agent.created_at < timestamp) | ((Agent.created_at == timestamp) & (Agent.id < item_id)))
    agents = query.order_by(Agent.created_at.desc(), Agent.id.desc()).limit(limit + 1).all()
    has_more = len(agents) > limit
    agents = agents[:limit]
    next_cursor = _next_cursor(agents[-1].created_at.isoformat(), agents[-1].id) if has_more and agents else None
    return {"data": [AgentOut.model_validate(agent) for agent in agents], "request_id": request.state.request_id, "meta": {"next_cursor": next_cursor}}


@router.get("/{agent_id}")
def get_agent(agent_id: str, request: Request, principal: Principal = Depends(require_permission("agent:read")), db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.id == agent_id, Agent.tenant_id == principal.tenant_id, Agent.deleted_at.is_(None)).first()
    if agent is None:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    return {"data": AgentOut.model_validate(agent), "request_id": request.state.request_id}


@router.patch("/{agent_id}")
def update_agent(agent_id: str, payload: AgentUpdate, request: Request, principal: Principal = Depends(require_permission("agent:write")), db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.id == agent_id, Agent.tenant_id == principal.tenant_id, Agent.deleted_at.is_(None)).first()
    if agent is None:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    if principal.role not in {"tenant_admin", "admin"}:
        raise HTTPException(status_code=403, detail="FORBIDDEN")
    expected = request.headers.get("If-Match")
    if expected is None or not expected.strip('"').strip():
        raise HTTPException(status_code=428, detail="PRECONDITION_REQUIRED")
    if expected.strip('"') != str(agent.version):
        raise HTTPException(status_code=412, detail="PRECONDITION_FAILED")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(agent, key, value)
    agent.version += 1
    agent.updated_by = principal.user_id
    record_audit(db, tenant_id=principal.tenant_id, actor_id=principal.user_id, action="agent.updated", resource_type="agent", resource_id=agent.id, request_id=request.state.request_id, metadata={"version": agent.version})
    db.commit(); db.refresh(agent)
    return {"data": AgentOut.model_validate(agent), "request_id": request.state.request_id}


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_agent(agent_id: str, request: Request, principal: Principal = Depends(require_permission("agent:delete")), db: Session = Depends(get_db)):
    if principal.role not in {"tenant_admin", "admin"}:
        raise HTTPException(status_code=403, detail="FORBIDDEN")
    agent = db.query(Agent).filter(Agent.id == agent_id, Agent.tenant_id == principal.tenant_id, Agent.deleted_at.is_(None)).first()
    if agent is None:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    agent.deleted_at = datetime.now(UTC); agent.updated_by = principal.user_id
    record_audit(db, tenant_id=principal.tenant_id, actor_id=principal.user_id, action="agent.deleted", resource_type="agent", resource_id=agent.id, request_id=request.state.request_id, metadata={"softDelete": True, "version": agent.version})
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{agent_id}/publish", status_code=status.HTTP_201_CREATED)
def publish_agent(agent_id: str, request: Request, principal: Principal = Depends(require_permission("agent:write")), db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.id == agent_id, Agent.tenant_id == principal.tenant_id, Agent.deleted_at.is_(None)).first()
    if agent is None: raise HTTPException(status_code=404, detail="NOT_FOUND")
    if principal.role not in {"tenant_admin", "admin"}: raise HTTPException(status_code=403, detail="FORBIDDEN")
    digest = hashlib.sha256(json.dumps(agent.definition, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    existing = db.query(AgentVersion).filter(AgentVersion.agent_id == agent.id, AgentVersion.tenant_id == principal.tenant_id, AgentVersion.version == agent.version).first()
    if existing is not None:
        if existing.content_digest != digest: raise HTTPException(status_code=409, detail="PUBLISHED_VERSION_CONFLICT")
        return {"data": AgentVersionOut.model_validate(existing), "request_id": request.state.request_id}
    published = AgentVersion(tenant_id=agent.tenant_id, agent_id=agent.id, version=agent.version, definition=agent.definition, content_digest=digest, published_by=principal.user_id)
    agent.status = "published"; db.add(published)
    record_audit(db, tenant_id=principal.tenant_id, actor_id=principal.user_id, action="agent.published", resource_type="agent", resource_id=agent.id, request_id=request.state.request_id, metadata={"version": agent.version, "contentDigest": digest})
    db.commit(); db.refresh(published)
    return {"data": AgentVersionOut.model_validate(published), "request_id": request.state.request_id}


@router.get("/{agent_id}/versions")
def list_agent_versions(agent_id: str, request: Request, principal: Principal = Depends(require_permission("agent:read")), db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.id == agent_id, Agent.tenant_id == principal.tenant_id, Agent.deleted_at.is_(None)).first()
    if agent is None: raise HTTPException(status_code=404, detail="NOT_FOUND")
    versions = db.query(AgentVersion).filter(AgentVersion.agent_id == agent_id, AgentVersion.tenant_id == principal.tenant_id).order_by(AgentVersion.version.desc()).all()
    return {"data": [AgentVersionOut.model_validate(version) for version in versions], "request_id": request.state.request_id}


@router.post("/{agent_id}/rollback", status_code=status.HTTP_201_CREATED)
def rollback_agent(agent_id: str, payload: AgentRollback, request: Request, principal: Principal = Depends(require_permission("agent:write")), db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.id == agent_id, Agent.tenant_id == principal.tenant_id, Agent.deleted_at.is_(None)).first()
    if agent is None: raise HTTPException(status_code=404, detail="NOT_FOUND")
    if principal.role not in {"tenant_admin", "admin"}: raise HTTPException(status_code=403, detail="FORBIDDEN")
    target = db.query(AgentVersion).filter(AgentVersion.agent_id == agent_id, AgentVersion.tenant_id == principal.tenant_id, AgentVersion.version == payload.version).first()
    if target is None: raise HTTPException(status_code=404, detail="VERSION_NOT_FOUND")
    agent.version += 1; agent.definition = target.definition; agent.status = "published"; agent.updated_by = principal.user_id
    digest = hashlib.sha256(json.dumps(target.definition, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    published = AgentVersion(tenant_id=agent.tenant_id, agent_id=agent.id, version=agent.version, definition=target.definition, content_digest=digest, published_by=principal.user_id)
    db.add(published)
    record_audit(db, tenant_id=principal.tenant_id, actor_id=principal.user_id, action="agent.rolled_back", resource_type="agent", resource_id=agent.id, request_id=request.state.request_id, metadata={"fromVersion": payload.version, "newVersion": agent.version})
    db.commit(); db.refresh(published)
    return {"data": AgentVersionOut.model_validate(published), "request_id": request.state.request_id}
