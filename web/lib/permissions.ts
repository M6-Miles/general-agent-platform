export type Permission = 'agent:read' | 'agent:write' | 'agent:delete' | 'run:read' | 'run:execute' | 'tool:read' | 'approval:read' | 'approval:decide' | 'audit:read' | 'audit:export' | 'memory:read' | 'memory:write' | 'admin:settings';

const permissionsByRole: Record<string, Set<Permission>> = {
  admin: new Set(['agent:read', 'agent:write', 'agent:delete', 'run:read', 'run:execute', 'tool:read', 'approval:read', 'approval:decide', 'audit:read', 'audit:export', 'memory:read', 'memory:write', 'admin:settings']),
  tenant_admin: new Set(['agent:read', 'agent:write', 'agent:delete', 'run:read', 'run:execute', 'tool:read', 'approval:read', 'approval:decide', 'audit:read', 'audit:export', 'memory:read', 'memory:write']),
  member: new Set(['agent:read', 'run:read', 'run:execute', 'tool:read', 'approval:read', 'audit:read', 'memory:read', 'memory:write']),
  readonly: new Set(['agent:read', 'run:read', 'tool:read', 'audit:read', 'memory:read']),
};

export function can(role: string | undefined, permission: Permission): boolean {
  return role ? permissionsByRole[role]?.has(permission) ?? false : false;
}
