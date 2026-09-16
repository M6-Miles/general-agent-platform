"""Workflow definition endpoints."""

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.audit import record_audit
from app.db import get_db
from app.dependencies import Principal, require_permission
from app.models import Agent, Run
from app.schemas import RunOut, WorkflowCreate, WorkflowUpdate

router = APIRouter(prefix="/api/v1/workflows", tags=["workflows"])


def _cursor(value: str | None) -> tuple[str, str] | None:
    from app.main import _decode_cursor
    return _decode_cursor(value)


def _next_cursor(value: str, item_id: str) -> str:
    from app.main import _encode_cursor
    return _encode_cursor(value, item_id)


def _validate_node_config(node_id: str, node_type: str, config: dict[str, Any]) -> None:
    """Validate editor-owned runtime fields before persisting a workflow."""
    def invalid(field: str, message: str) -> None:
        raise HTTPException(
            status_code=422,
            detail={"code": "WORKFLOW_NODE_INVALID", "node_id": node_id, "field": field, "message": message},
        )

    if node_type == "model" and not str(config.get("prompt", "")).strip():
        invalid("prompt", "模型 Prompt 不能为空")
    if node_type == "tool":
        if not str(config.get("tool_id") or config.get("tool_name") or "").strip():
            invalid("tool_id", "必须选择一个工具")
        tool_input = config.get("input", {})
        if not isinstance(tool_input, dict):
            invalid("input", "输入参数必须是 JSON 对象")
    if node_type == "condition":
        if config.get("condition_type") != "comparison":
            invalid("condition_type", "条件类型必须为 comparison")
        if not str(config.get("left", "")).strip():
            invalid("left", "左值字段不能为空")
        if config.get("operator") not in {"equals", "not_equals", "contains", "not_contains", "greater_than", "less_than", "regex_match"}:
            invalid("operator", "请选择有效的比较运算符")
        if config.get("right") is None or (isinstance(config.get("right"), str) and not config["right"].strip()):
            invalid("right", "右值不能为空")
        if not str(config.get("true_next", "")).strip():
            invalid("true_next", "必须配置满足时的目标节点")
        if not str(config.get("false_next", "")).strip():
            invalid("false_next", "必须配置不满足时的目标节点")


def workflow_payload(nodes: list[dict[str, Any]], edges: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not nodes: raise HTTPException(status_code=422, detail="WORKFLOW_NODES_REQUIRED")
    node_ids = [str(node.get("id") or node.get("key") or "").strip() for node in nodes]
    if any(not node_id for node_id in node_ids) or len(set(node_ids)) != len(node_ids):
        raise HTTPException(status_code=422, detail="INVALID_WORKFLOW")
    edges_by_target: dict[str, list[str]] = {}
    known_nodes = set(node_ids)
    seen_edges: set[tuple[str, str]] = set()
    for index, edge in enumerate(edges):
        source = str(edge.get("source") or "").strip()
        target = str(edge.get("target") or "").strip()
        if not source or not target or source not in known_nodes or target not in known_nodes or source == target:
            raise HTTPException(
                status_code=422,
                detail={"code": "WORKFLOW_EDGE_INVALID", "edge_index": index, "source": source, "target": target},
            )
        edge_key = (source, target)
        if edge_key in seen_edges:
            continue
        seen_edges.add(edge_key)
        edges_by_target.setdefault(target, []).append(source)
    workflow = []
    for node in nodes:
        key = node.get("id") or node.get("key")
        if not key: continue
        data = node.get("data") or {}
        root_config = {key: value for key, value in node.items() if key not in {"id", "key", "type", "label", "data", "config"}}
        config = {**root_config, **(node.get("config") or {}), **(data.get("config") or {})}
        node_type = data.get("kind") or config.get("kind") or node.get("type") or "model"
        _validate_node_config(str(key), str(node_type), config)
        # Runtime fields live at the node root. Keep the editor config as well
        # so a saved workflow can be opened and edited without losing details.
        workflow.append({
            **config,
            "key": str(key),
            "type": str(node_type),
            "label": str(data.get("label") or node.get("label") or key),
            "config": config,
            "depends_on": edges_by_target.get(str(key), []),
        })
    if not workflow: raise HTTPException(status_code=422, detail="WORKFLOW_NODES_REQUIRED")
    from app.runtime import order_workflow
    try:
        order_workflow(workflow)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return workflow


def _graph_from_stored_workflow(raw_workflow: Any) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    if isinstance(raw_workflow, dict):
        nodes = raw_workflow.get("nodes", [])
        edges = raw_workflow.get("edges", [])
        return (nodes if isinstance(nodes, list) else [], edges if isinstance(edges, list) else [])
    nodes = raw_workflow if isinstance(raw_workflow, list) else []
    edges = [
        {"source": str(parent), "target": str(node.get("key") or node.get("id"))}
        for node in nodes
        if isinstance(node, dict) and (node.get("key") or node.get("id"))
        for parent in (node.get("depends_on", []) if isinstance(node.get("depends_on", []), list) else [])
    ]
    return nodes, edges


def workflow_out(agent: Agent) -> dict[str, Any]:
    definition = agent.definition or {}
    raw_workflow = definition.get("workflow", [])
    # Older agents store workflow as {nodes, edges}, while the runtime format
    # stores a plain list of nodes with depends_on. Normalize both formats so
    # the list/detail endpoints never crash on valid persisted definitions.
    nodes, stored_edges = _graph_from_stored_workflow(raw_workflow)
    nodes = [
        {**node, "id": str(node.get("id") or node.get("key")), "key": str(node.get("key") or node.get("id"))}
        for node in nodes
        if isinstance(node, dict) and (node.get("id") or node.get("key"))
    ]
    edges = [dict(edge) for edge in stored_edges if isinstance(edge, dict) and edge.get("source") and edge.get("target")]
    if not stored_edges:
        edges.extend(
            [
            {"id": f"{parent}-{node.get('key')}", "source": parent, "target": node.get("key"), "animated": True}
            for node in nodes
            for parent in (node.get("depends_on", []) if isinstance(node.get("depends_on", []), list) else [])
            if parent and node.get("key")
            ]
        )
    for node in nodes:
        if node.get("type") != "condition":
            continue
        for branch, target_field in (("true", "true_next"), ("false", "false_next")):
            target = node.get(target_field)
            if not target:
                continue
            existing = next(
                (
                    edge for edge in edges
                    if str(edge["source"]) == str(node["key"])
                    and str(edge["target"]) == str(target)
                    and edge.get("sourceHandle") in {None, branch}
                ),
                None,
            )
            if existing is not None:
                existing["sourceHandle"] = branch
                existing["condition"] = branch
                continue
            edges.append({
                "id": f"{node['key']}-{branch}-{target}",
                "source": node["key"],
                "target": target,
                "sourceHandle": branch,
                "condition": branch,
                "animated": True,
            })
    return {"id": agent.id, "agent_id": agent.id, "name": agent.name, "description": definition.get("description", ""), "status": agent.status, "version": agent.version, "nodes": nodes, "edges": edges, "definition": definition, "created_at": agent.created_at, "updated_at": agent.updated_at}


@router.get("", summary="List workflows", description="List tenant-scoped workflows with optional search and cursor pagination.")
def list_workflows(request: Request, limit: int = Query(default=100, ge=1, le=100), cursor: str | None = None, search: str | None = None, principal: Principal = Depends(require_permission("agent:read")), db: Session = Depends(get_db)):
    query = db.query(Agent).filter(Agent.tenant_id == principal.tenant_id, Agent.deleted_at.is_(None))
    if search: query = query.filter(Agent.name.ilike(f"%{search}%"))
    decoded = _cursor(cursor)
    if decoded:
        timestamp, item_id = decoded
        parsed = datetime.fromisoformat(timestamp)
        query = query.filter((Agent.updated_at < parsed) | ((Agent.updated_at == parsed) & (Agent.id < item_id)))
    agents = query.order_by(Agent.updated_at.desc(), Agent.id.desc()).limit(limit + 1).all()
    has_more = len(agents) > limit; agents = agents[:limit]
    next_cursor = _next_cursor(agents[-1].updated_at.isoformat(), agents[-1].id) if has_more and agents else None
    return {"data": [workflow_out(agent) for agent in agents if (agent.definition or {}).get("workflow")], "request_id": request.state.request_id, "meta": {"next_cursor": next_cursor}}


@router.post("", status_code=status.HTTP_201_CREATED, summary="Create workflow", description="Create a tenant-scoped workflow definition.")
def create_workflow(payload: WorkflowCreate, request: Request, principal: Principal = Depends(require_permission("agent:write")), db: Session = Depends(get_db)):
    definition = dict(payload.definition or {})
    stored_nodes, stored_edges = _graph_from_stored_workflow(definition.get("workflow", []))
    nodes = payload.nodes or stored_nodes
    edges = payload.edges if payload.nodes else (payload.edges or stored_edges)
    workflow = workflow_payload(nodes, edges)
    definition["workflow"] = workflow; definition["description"] = payload.description
    agent = Agent(tenant_id=principal.tenant_id, name=payload.name, definition=definition, created_by=principal.user_id, updated_by=principal.user_id)
    db.add(agent); db.flush()
    record_audit(db, tenant_id=principal.tenant_id, actor_id=principal.user_id, action="workflow.created", resource_type="workflow", resource_id=agent.id, request_id=request.state.request_id)
    try: db.commit()
    except IntegrityError as exc:
        db.rollback(); raise HTTPException(status_code=409, detail="CONFLICT") from exc
    db.refresh(agent)
    return {"data": workflow_out(agent), "request_id": request.state.request_id}


@router.get("/{workflow_id}", summary="Get workflow", description="Get one tenant-scoped workflow and its recent runs.")
def get_workflow(workflow_id: str, request: Request, principal: Principal = Depends(require_permission("agent:read")), db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.id == workflow_id, Agent.tenant_id == principal.tenant_id, Agent.deleted_at.is_(None)).first()
    if agent is None: raise HTTPException(status_code=404, detail="NOT_FOUND")
    if not (agent.definition or {}).get("workflow"): raise HTTPException(status_code=404, detail="WORKFLOW_NOT_FOUND")
    runs = db.query(Run).filter(Run.agent_id == agent.id, Run.tenant_id == principal.tenant_id).order_by(Run.created_at.desc()).limit(20).all()
    data = workflow_out(agent); data["runs"] = [RunOut.model_validate(run) for run in runs]
    return {"data": data, "request_id": request.state.request_id}


@router.put("/{workflow_id}", summary="Update workflow", description="Update a workflow using optimistic concurrency via If-Match.")
def update_workflow(workflow_id: str, payload: WorkflowUpdate, request: Request, principal: Principal = Depends(require_permission("agent:write")), db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.id == workflow_id, Agent.tenant_id == principal.tenant_id, Agent.deleted_at.is_(None)).first()
    if agent is None: raise HTTPException(status_code=404, detail="NOT_FOUND")
    expected = request.headers.get("If-Match")
    if expected is None or not expected.strip('"').strip(): raise HTTPException(status_code=428, detail="PRECONDITION_REQUIRED")
    if expected.strip('"') != str(agent.version): raise HTTPException(status_code=412, detail="PRECONDITION_FAILED")
    definition = dict(agent.definition or {})
    existing_nodes, existing_edges = _graph_from_stored_workflow(definition.get("workflow", []))
    incoming_workflow: Any = None
    has_incoming_workflow = False
    if payload.definition is not None:
        incoming_definition = dict(payload.definition)
        if "workflow" in incoming_definition:
            has_incoming_workflow = True
            incoming_workflow = incoming_definition.pop("workflow")
        definition.update(incoming_definition)
    if payload.nodes is not None:
        definition["workflow"] = workflow_payload(payload.nodes, payload.edges if payload.edges is not None else existing_edges)
    elif has_incoming_workflow:
        incoming_nodes, incoming_edges = _graph_from_stored_workflow(incoming_workflow)
        definition["workflow"] = workflow_payload(incoming_nodes, payload.edges if payload.edges is not None else incoming_edges)
    elif payload.edges is not None:
        definition["workflow"] = workflow_payload(existing_nodes, payload.edges)
    if payload.description is not None: definition["description"] = payload.description
    agent.definition = definition
    if payload.name is not None: agent.name = payload.name
    agent.version += 1; agent.status = "draft"; agent.updated_by = principal.user_id
    record_audit(db, tenant_id=principal.tenant_id, actor_id=principal.user_id, action="workflow.updated", resource_type="workflow", resource_id=agent.id, request_id=request.state.request_id, metadata={"nodes": len(definition.get("workflow", [])), "version": agent.version})
    db.commit(); db.refresh(agent)
    return {"data": workflow_out(agent), "request_id": request.state.request_id}


@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete workflow", description="Soft-delete a tenant-scoped workflow.")
def delete_workflow(workflow_id: str, request: Request, principal: Principal = Depends(require_permission("agent:delete")), db: Session = Depends(get_db)):
    if principal.role not in {"tenant_admin", "admin"}: raise HTTPException(status_code=403, detail="FORBIDDEN")
    agent = db.query(Agent).filter(Agent.id == workflow_id, Agent.tenant_id == principal.tenant_id, Agent.deleted_at.is_(None)).first()
    if agent is None: raise HTTPException(status_code=404, detail="NOT_FOUND")
    agent.deleted_at = datetime.now(UTC); agent.updated_by = principal.user_id
    record_audit(db, tenant_id=principal.tenant_id, actor_id=principal.user_id, action="workflow.deleted", resource_type="workflow", resource_id=agent.id, request_id=request.state.request_id, metadata={"softDelete": True})
    db.commit(); return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{workflow_id}/duplicate", status_code=status.HTTP_201_CREATED, summary="Duplicate workflow", description="Create a copy of a tenant-scoped workflow.")
def duplicate_workflow(workflow_id: str, request: Request, principal: Principal = Depends(require_permission("agent:write")), db: Session = Depends(get_db)):
    source = db.query(Agent).filter(Agent.id == workflow_id, Agent.tenant_id == principal.tenant_id, Agent.deleted_at.is_(None)).first()
    if source is None or not (source.definition or {}).get("workflow"): raise HTTPException(status_code=404, detail="NOT_FOUND")
    agent = Agent(tenant_id=principal.tenant_id, name=f"{source.name} (copy)", definition=dict(source.definition), created_by=principal.user_id, updated_by=principal.user_id)
    db.add(agent); db.commit(); db.refresh(agent)
    record_audit(db, tenant_id=principal.tenant_id, actor_id=principal.user_id, action="workflow.duplicated", resource_type="workflow", resource_id=agent.id, request_id=request.state.request_id, metadata={"source_id": source.id}); db.commit()
    return {"data": workflow_out(agent), "request_id": request.state.request_id}
