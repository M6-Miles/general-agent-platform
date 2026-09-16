from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    tenant_slug: str | None = Field(default=None, min_length=1, max_length=100)


class RegisterRequest(BaseModel):
    """Self-service registration for local demos.

    Registration creates a new tenant and its first administrator. Production
    deployments should disable this endpoint and use an invite/provisioning
    flow instead.
    """

    tenant_slug: str = Field(min_length=3, max_length=100, pattern=r"^[a-z0-9][a-z0-9-]*[a-z0-9]$")
    tenant_name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    display_name: str = Field(min_length=1, max_length=200)
    password: str = Field(min_length=12, max_length=128)


class InviteUserRequest(BaseModel):
    email: EmailStr
    display_name: str = Field(min_length=1, max_length=200)


class InviteUserResponse(BaseModel):
    email: EmailStr
    temporary_password: str
    role: str


class PasswordResetRequest(BaseModel):
    tenant_slug: str = Field(min_length=1, max_length=100)
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str = Field(min_length=20, max_length=4096)
    new_password: str = Field(min_length=12, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    tenant_id: str
    email: EmailStr
    display_name: str
    role: str
    tenant_name: str | None = None


class ProfileUpdate(BaseModel):
    display_name: str = Field(min_length=1, max_length=200)
    preferences: dict[str, Any] = Field(default_factory=dict)


class PasswordUpdate(BaseModel):
    current_password: str = Field(min_length=12, max_length=128)
    new_password: str = Field(min_length=12, max_length=128)


class AuthData(BaseModel):
    access_token: str
    expires_at: datetime
    user: UserOut


class AuthResponse(BaseModel):
    data: AuthData
    request_id: str


class AgentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    definition: dict[str, Any] = Field(default_factory=dict)


class AgentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    definition: dict[str, Any] | None = None


class AgentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    tenant_id: str
    name: str
    status: str
    version: int
    definition: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class AgentVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    id: str
    agent_id: str
    version: int
    definition: dict[str, Any]
    content_digest: str
    published_at: datetime


class AgentRollback(BaseModel):
    version: int = Field(ge=1)


class SkillCreate(BaseModel):
    slug: str = Field(min_length=1, max_length=120, pattern=r"^[a-z0-9][a-z0-9._-]*$")
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=1000)
    version: str = Field(default="1.0.0", pattern=r"^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$")
    manifest: dict[str, Any] = Field(default_factory=dict)


class SkillReview(BaseModel):
    decision: str = Field(pattern="^(approve|reject)$")
    reason: str = Field(default="", max_length=500)


class SkillOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    tenant_id: str
    slug: str
    name: str
    description: str
    version: str
    manifest_json: dict[str, Any]
    content_digest: str
    status: str
    review_reason: str | None = None
    created_at: datetime
    updated_at: datetime


class RunCreate(BaseModel):
    agent_id: str = Field(min_length=1, max_length=100)
    input: dict[str, Any] = Field(default_factory=dict)
    workflow_id: str | None = None


class RestoreRequest(BaseModel):
    checkpoint_version: int = Field(ge=1)


class RunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    id: str
    tenant_id: str
    agent_id: str
    agent_version_id: str | None = None
    status: str
    attempt_id: str
    checkpoint_version: int
    created_at: datetime
    updated_at: datetime
    finished_at: datetime | None = None
    output_json: dict[str, Any] | None = None
    usage_json: dict[str, Any] = Field(default_factory=dict)
    cost_usd: float = 0.0
    snapshot_id: str | None = None
    input_json: dict[str, Any] = Field(default_factory=dict)


class WorkflowInstanceCreate(BaseModel):
    workflow_id: str = Field(min_length=1, max_length=100)
    input: dict[str, Any] = Field(default_factory=dict)


class WorkflowInstanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    tenant_id: str
    workflow_id: str
    run_id: str | None = None
    status: str
    input_json: dict[str, Any] = Field(default_factory=dict)
    output_json: dict[str, Any] | None = None
    created_by: str
    created_at: datetime
    updated_at: datetime


class WorkflowDefinitionUpdate(BaseModel):
    nodes: list[dict[str, Any]] = Field(default_factory=list, max_length=100)
    edges: list[dict[str, Any]] = Field(default_factory=list, max_length=200)


class WorkflowCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=500)
    nodes: list[dict[str, Any]] = Field(default_factory=list, max_length=100)
    edges: list[dict[str, Any]] = Field(default_factory=list, max_length=200)
    definition: dict[str, Any] | None = None


class WorkflowUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    nodes: list[dict[str, Any]] | None = Field(default=None, max_length=100)
    edges: list[dict[str, Any]] | None = Field(default=None, max_length=200)
    definition: dict[str, Any] | None = None


class AuditEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    event_id: str | None = None
    tenant_id: str
    actor_id: str | None
    principal_type: str | None = None
    action: str
    resource_type: str
    resource_id: str
    request_id: str
    correlation_id: str | None = None
    schema_version: int
    reason_code: str
    ip_hash: str | None
    user_agent_hash: str | None
    outcome: str
    metadata_json: dict[str, Any]
    metadata_redacted: dict[str, Any]
    created_at: datetime


class MemoryCreate(BaseModel):
    content: str = Field(min_length=1, max_length=5000)
    metadata: dict[str, Any] = Field(default_factory=dict)


class MemoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    id: str
    tenant_id: str
    agent_id: str
    run_id: str
    content: str
    metadata_json: dict[str, Any]
    created_at: datetime


class KnowledgeBaseCreate(BaseModel):
    slug: str = Field(min_length=1, max_length=120, pattern="^[a-z0-9][a-z0-9_-]*$")
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=1000)


class KnowledgeBaseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    tenant_id: str
    slug: str
    name: str
    description: str
    created_at: datetime


class KnowledgeDocumentCreate(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1, max_length=200000)
    content_type: str = Field(default="text/plain", max_length=100)


class KnowledgeQuery(BaseModel):
    query: str = Field(min_length=1, max_length=2000)
    top_k: int = Field(default=5, ge=1, le=10)
    retrieval_mode: str = Field(default="hybrid", pattern="^(vector_only|bm25_only|hybrid)$")
    enable_reranker: bool = False


class ToolCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=500)
    executor: str = Field(min_length=1, max_length=100)
    input_schema: dict[str, Any] = Field(default_factory=dict)
    output_schema: dict[str, Any] = Field(default_factory=dict)
    side_effects: bool = False
    risk_level: str = Field(default="low", pattern="^(low|medium|high|critical)$")
    timeout_ms: int = Field(default=5000, ge=100, le=120000)
    manifest: dict[str, Any] = Field(default_factory=dict)
    capabilities: dict[str, Any] = Field(default_factory=dict)


class ToolUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    executor: str | None = Field(default=None, min_length=1, max_length=100)
    input_schema: dict[str, Any] | None = None
    output_schema: dict[str, Any] | None = None
    side_effects: bool | None = None
    risk_level: str | None = Field(default=None, pattern="^(low|medium|high|critical)$")
    timeout_ms: int | None = Field(default=None, ge=100, le=120000)


class ToolOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    tenant_id: str
    name: str
    version: int
    description: str
    executor: str
    input_schema: dict[str, Any]
    output_schema: dict[str, Any]
    side_effects: bool
    risk_level: str
    timeout_ms: int
    status: str
    content_digest: str | None = None
    signature_status: str = "unsigned"


class ToolVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    tool_definition_id: str
    version: int
    name: str
    description: str
    executor: str
    input_schema: dict[str, Any]
    output_schema: dict[str, Any]
    side_effects: bool
    risk_level: str
    timeout_ms: int
    content_digest: str | None = None
    signature_status: str
    created_by: str
    created_at: datetime


class ToolRollback(BaseModel):
    version: int = Field(ge=1)


class ToolCallCreate(BaseModel):
    tool_name: str = Field(min_length=1, max_length=100)
    input: dict[str, Any] = Field(default_factory=dict)
    idempotency_key: str = Field(min_length=16, max_length=200)


class ToolCallOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    run_id: str
    tool_definition_id: str
    status: str
    idempotency_key: str
    input_json: dict[str, Any]
    output_json: dict[str, Any] | None
    error_code: str | None
    attempt: int
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None


class ApprovalDecision(BaseModel):
    decision: str = Field(pattern="^(approve|reject)$")
    reason: str | None = Field(default=None, max_length=1000)
    token: str = Field(min_length=32, max_length=128)


class ApprovalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    run_id: str
    tool_call_id: str
    status: str
    decision_reason: str | None
    expires_at: datetime
    snapshot_id: str | None = None
    used_at: datetime | None = None


class TenantQuotaUpdate(BaseModel):
    monthly_token_limit: int = Field(ge=0)
    monthly_cost_limit_usd: float = Field(ge=0)
    max_concurrent_runs: int = Field(ge=0)
    warning_percent: int = Field(default=90, ge=1, le=100)
    max_requests_per_minute: int = Field(default=120, ge=0)
    max_knowledge_documents: int = Field(default=0, ge=0)
    max_workflow_runs_per_day: int = Field(default=0, ge=0)


class TenantQuotaOut(TenantQuotaUpdate):
    tenant_id: str
    usage: dict[str, Any] = Field(default_factory=dict)


class AdminSettingsUpdate(BaseModel):
    model_name: str | None = Field(default=None, min_length=1, max_length=255)
    embedding_provider: str | None = Field(default=None, pattern="^(mock|sentence_transformers)$")
    embedding_model: str | None = Field(default=None, min_length=1, max_length=255)
    rate_limit_enabled: bool | None = None
    rate_limit_default: int | None = Field(default=None, ge=0, le=1_000_000)


class AdminSettingsOut(BaseModel):
    app_env: str
    model_provider: str
    model_name: str
    embedding_provider: str
    embedding_model: str
    rate_limit_enabled: bool
    rate_limit_default: int
