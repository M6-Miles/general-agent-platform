export const roleLabels: Record<string, string> = {
  admin: '系统管理员',
  tenant_admin: '租户管理员',
  member: '成员',
  readonly: '只读成员',
};

const commonLabels: Record<string, string> = {
  draft: '草稿',
  testing: '测试中',
  published: '已发布',
  paused: '已暂停',
  archived: '已归档',
  pending: '待处理',
  pending_review: '待审核',
  approved: '已批准',
  rejected: '已驳回',
  success: '成功',
  completed: '已完成',
  failed: '失败',
  expired: '已过期',
  low: '低',
  medium: '中',
  high: '高',
  critical: '严重',
  agent: 'Agent',
  skill: 'Skill',
  run: '运行',
  accepted: '已接受',
  preparing: '准备中',
  running: '运行中',
  waiting_approval: '等待审批',
  cancelled: '已取消',
  timed_out: '已超时',
  budget_exceeded: '超出预算',
  approval: '审批',
};

export function displayLabel(value: string | null | undefined): string {
  if (!value) return '-';
  return commonLabels[value] ?? value;
}
