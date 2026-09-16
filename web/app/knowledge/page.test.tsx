import {render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import KnowledgePage from './page';

const request = vi.fn();
const push = vi.fn();
const router = { push };
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('../components/AuthProvider', () => ({useAuth: () => ({token: 'token', user: null})}));
vi.mock('../components/NotificationProvider', () => ({useNotifier: () => vi.fn()}));
vi.mock('../components/PlatformHeader', () => ({default: () => <div>Header</div>}));
vi.mock('../../lib/api', () => ({apiBaseUrl: '', apiRequest: (...args: unknown[]) => request(...args)}));

describe('KnowledgePage', () => {
  beforeEach(() => {
    request.mockReset();
    request.mockResolvedValue({data: [{id: 'kb-1', slug: 'demo', name: '演示库', description: '示例知识库', created_at: '2024-01-01'}]});
  });

  it('loads and displays knowledge bases list', async () => {
    render(<KnowledgePage />);
    await waitFor(() => expect(screen.getByText('演示库')).toBeInTheDocument(), { timeout: 3000 });
    await waitFor(() => expect(screen.getByText('示例知识库')).toBeInTheDocument(), { timeout: 1000 });
  });
});
