import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import ConversationsPage from './page';

const request = vi.fn();
const notify = vi.fn();
vi.mock('../components/AuthProvider', () => ({useAuth: () => ({token: 'token'})}));
vi.mock('../components/NotificationProvider', () => ({useNotifier: () => notify}));
vi.mock('../components/Workspace', () => ({default: ({children}: {children: React.ReactNode}) => <main>{children}</main>}));
vi.mock('../../lib/api', () => ({apiBaseUrl: '', apiRequest: (...args: unknown[]) => request(...args)}));

function sseResponse(chunks: string[]) {
  let index = 0;
  return {ok: true, body: {getReader: () => ({read: async () => index < chunks.length ? {value: new TextEncoder().encode(chunks[index++]), done: false} : {value: undefined, done: true}, cancel: vi.fn()})}};
}

describe('ConversationsPage SSE', () => {
  beforeEach(() => {
    request.mockReset(); notify.mockReset();
    request.mockResolvedValue({data: []});
    request.mockResolvedValueOnce({data: [{id: 'agent-1', name: '测试 Agent'}]}).mockResolvedValueOnce({data: []});
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('parses events and refreshes the final run result', async () => {
    request.mockResolvedValueOnce({data: [{id: 'agent-1', name: '测试 Agent'}]}).mockResolvedValueOnce({data: []})
      .mockResolvedValueOnce({data: {id: 'run-1', agent_id: 'agent-1', status: 'accepted', created_at: '', updated_at: '', input_json: {prompt: 'hi'}, output_json: null}})
      .mockResolvedValueOnce({data: [{id: 'run-1', agent_id: 'agent-1', status: 'completed', created_at: '', updated_at: '', output_json: {text: 'done'}}]})
      .mockResolvedValueOnce({data: {id: 'run-1', agent_id: 'agent-1', status: 'completed', created_at: '', updated_at: '', output_json: {text: 'done'}}});
    vi.mocked(fetch).mockResolvedValueOnce(sseResponse(['event: node_started\ndata: {"sequence":1,"data":{"node_key":"prepare"}}\n\n', 'event: run_completed\ndata: {"sequence":2,"data":{"status":"completed"}}\n\n']) as unknown as Response);
    render(<ConversationsPage />);
    await waitFor(() => expect(screen.getByText('测试 Agent')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('消息'), {target: {value: 'hi'}});
    fireEvent.click(screen.getByRole('button', {name: '发送消息'}));
    await waitFor(() => expect(screen.getByText('node_started')).toBeInTheDocument());
    expect(screen.getByText('run_completed')).toBeInTheDocument();
  });

  it('reconnects with the last event id after a dropped stream', async () => {
    request.mockResolvedValueOnce({data: [{id: 'agent-1', name: '测试 Agent'}]}).mockResolvedValueOnce({data: []}).mockResolvedValueOnce({data: {id: 'run-2', agent_id: 'agent-1', status: 'accepted', created_at: '', updated_at: ''}});
    let reads = 0;
    const dropped = {ok: true, body: {getReader: () => ({read: async () => { reads += 1; if (reads === 1) return {value: new TextEncoder().encode('event: node_started\ndata: {"sequence":4,"data":{}}\n\n'), done: false}; throw new Error('network'); }})}};
    vi.mocked(fetch).mockResolvedValueOnce(dropped as unknown as Response).mockResolvedValueOnce(sseResponse(['event: run_completed\ndata: {"sequence":5,"data":{}}\n\n']) as unknown as Response);
    render(<ConversationsPage />);
    await waitFor(() => expect(screen.getByText('测试 Agent')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('消息'), {target: {value: 'retry'}}); fireEvent.click(screen.getByRole('button', {name: '发送消息'}));
    await waitFor(() => expect(screen.getByText('run_completed')).toBeInTheDocument(), {timeout: 3000});
    expect(vi.mocked(fetch).mock.calls[1][1]).toEqual(expect.objectContaining({headers: expect.objectContaining({'Last-Event-ID': '4'})}));
  });

  it('aborts the active SSE request when the page unmounts', async () => {
    request.mockResolvedValueOnce({data: [{id: 'agent-1', name: '测试 Agent'}]}).mockResolvedValueOnce({data: []}).mockResolvedValueOnce({data: {id: 'run-3', agent_id: 'agent-1', status: 'accepted', created_at: '', updated_at: ''}});
    let signal: AbortSignal | undefined;
    vi.mocked(fetch).mockImplementationOnce((_input, init) => { signal = init?.signal as AbortSignal; return Promise.resolve({ok: true, body: {getReader: () => ({read: () => new Promise(() => undefined)})}} as unknown as Response); });
    const view = render(<ConversationsPage />);
    await waitFor(() => expect(screen.getByText('测试 Agent')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('消息'), {target: {value: 'cancel'}}); fireEvent.click(screen.getByRole('button', {name: '发送消息'}));
    await waitFor(() => expect(signal).toBeDefined());
    view.unmount();
    expect(signal?.aborted).toBe(true);
  });

  it('uses readable titles for system-triggered runs without a prompt', async () => {
    request.mockReset();
    request.mockResolvedValueOnce({data: [{id: 'agent-1', name: '审批 Agent'}]})
      .mockResolvedValueOnce({data: [{id: 'run-restore', agent_id: 'agent-1', status: 'failed', created_at: '2026-09-15T02:00:00Z', updated_at: '2026-09-15T02:00:00Z', input_json: {source: 'restore'}}, {id: 'run-route', agent_id: 'agent-1', status: 'completed', created_at: '2026-09-15T01:00:00Z', updated_at: '2026-09-15T01:00:00Z', input_json: {route: 'approved'}}]});
    render(<ConversationsPage />);
    await waitFor(() => expect(screen.getByText('恢复运行')).toBeInTheDocument());
    expect(screen.getByText('条件分支：approved')).toBeInTheDocument();
    expect(screen.queryByText('未记录文本消息')).not.toBeInTheDocument();
  });
});
