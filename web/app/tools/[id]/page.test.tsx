import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import ToolDetailPage from './page';

const request = vi.fn();
const replace = vi.fn();
const notify = vi.fn();
const confirm = vi.fn();
const tool = {
  id: 'tool-1',
  name: '订单查询',
  description: '查询订单信息',
  executor: 'builtin.echo',
  input_schema: {type: 'object'},
  output_schema: {type: 'object'},
  side_effects: false,
  risk_level: 'low',
  timeout_ms: 5000,
  version: 2,
  status: 'active',
  signature_status: 'unsigned',
};
const versions = [
  {...tool, id: 'version-2', tool_definition_id: 'tool-1', version: 2, created_by: 'admin-1', created_at: '2026-09-14T10:00:00Z'},
  {...tool, id: 'version-1', tool_definition_id: 'tool-1', version: 1, created_by: 'admin-1', created_at: '2026-09-13T10:00:00Z'},
];

vi.mock('../../components/AuthProvider', () => ({useAuth: () => ({token: 'token', user: {role: 'admin'}})}));
vi.mock('../../components/NotificationProvider', () => ({useNotifier: () => notify, useConfirm: () => confirm}));
vi.mock('../../components/Workspace', () => ({default: ({children}: {children: React.ReactNode}) => <main>{children}</main>}));
vi.mock('../../../lib/api', () => ({
  apiBaseUrl: '',
  isAbortError: () => false,
  apiRequest: (...args: unknown[]) => request(...args),
}));
vi.mock('next/navigation', () => ({useParams: () => ({id: 'tool-1'}), useRouter: () => ({replace})}));

describe('ToolDetailPage operations', () => {
  beforeEach(() => {
    request.mockReset();
    replace.mockReset();
    notify.mockReset();
    confirm.mockReset();
    confirm.mockResolvedValue(true);
    request.mockImplementation((_base: string, path: string, _token: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') return Promise.resolve({data: {...tool, name: '订单检索', version: 3}});
      if (init?.method === 'DELETE') return Promise.resolve({});
      if (init?.method === 'POST' && path.endsWith('/rollback')) return Promise.resolve({data: {...tool, version: 3}});
      if (path.endsWith('/versions')) return Promise.resolve({data: versions});
      if (path.endsWith('/calls')) return Promise.resolve({data: []});
      return Promise.resolve({data: tool});
    });
  });

  it('edits configuration with the current version', async () => {
    render(<ToolDetailPage />);
    fireEvent.click(await screen.findByRole('button', {name: '编辑配置'}));
    fireEvent.change(screen.getByLabelText(/工具名称/), {target: {value: '订单检索'}});
    fireEvent.click(screen.getByRole('button', {name: '保存配置'}));
    await waitFor(() => expect(request).toHaveBeenCalledWith(
      '',
      '/api/v1/tools/tool-1',
      'token',
      expect.objectContaining({method: 'PATCH', headers: {'If-Match': '2'}}),
    ));
    expect(await screen.findByText('订单检索')).toBeInTheDocument();
  });

  it('loads history and deletes after confirmation', async () => {
    render(<ToolDetailPage />);
    fireEvent.click(await screen.findByRole('button', {name: '调用历史'}));
    expect(await screen.findByText('暂无调用记录')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: '删除工具'}));
    await waitFor(() => expect(confirm).toHaveBeenCalled());
    await waitFor(() => expect(request).toHaveBeenCalledWith('', '/api/v1/tools/tool-1', 'token', {method: 'DELETE'}));
    expect(replace).toHaveBeenCalledWith('/tools');
  });

  it('shows immutable versions and rolls back with the current version', async () => {
    render(<ToolDetailPage />);
    fireEvent.click(await screen.findByRole('button', {name: '版本历史'}));
    expect(await screen.findByText('v1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: '回滚到此版本'}));
    await waitFor(() => expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining('创建新的 v3'),
      '回滚到 v1',
    ));
    await waitFor(() => expect(request).toHaveBeenCalledWith(
      '',
      '/api/v1/tools/tool-1/rollback',
      'token',
      expect.objectContaining({method: 'POST', headers: {'If-Match': '2'}}),
    ));
  });
});
