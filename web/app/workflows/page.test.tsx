import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WorkflowsPage from './page';
import NotificationProvider from '../components/NotificationProvider';
const request = vi.fn();
const push = vi.fn();
const router = { push };
vi.mock('../components/AuthProvider', () => ({ useAuth: () => ({ token: 'token' }) }));
vi.mock('../components/PlatformHeader', () => ({ default: () => <div>Header</div> }));
vi.mock('../../lib/api', () => ({ apiBaseUrl: '', apiRequest: (...args: unknown[]) => request(...args) }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@xyflow/react', () => ({ ReactFlow: ({ children }: { children: React.ReactNode }) => <div data-testid="flow">{children}</div>, Background: () => null, Controls: () => null, MiniMap: () => null, addEdge: (edge: unknown, items: unknown[]) => [...items, edge], applyNodeChanges: (_: unknown, items: unknown[]) => items, applyEdgeChanges: (_: unknown, items: unknown[]) => items }));
describe('WorkflowsPage', () => {
  beforeEach(() => {
    request.mockReset();
    request.mockResolvedValue({ data: [{ id: 'wf-1', name: '测试工作流', description: '测试描述', status: 'draft', created_at: '2024-01-01', updated_at: '2024-01-01' }] });
  });
  it('loads and displays workflows list', async () => {
    render(<NotificationProvider><WorkflowsPage /></NotificationProvider>);
    await waitFor(() => expect(screen.getByText('测试工作流')).toBeInTheDocument(), { timeout: 3000 });
    await waitFor(() => expect(screen.getByText('测试描述')).toBeInTheDocument(), { timeout: 1000 });
  });
});
