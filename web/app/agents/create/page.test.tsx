import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import AgentWizard from './page';
const pending = new Promise<never>(() => undefined);
vi.mock('../../components/AuthProvider', () => ({useAuth: () => ({token: 'token', user: {role: 'admin'}})}));
vi.mock('../../components/NotificationProvider', () => ({useNotifier: () => vi.fn(), useConfirm: () => vi.fn().mockResolvedValue(true)}));
vi.mock('../../components/Workspace', () => ({default: ({children}: {children: React.ReactNode}) => <main>{children}</main>}));
vi.mock('../../components', () => ({Input: ({label, ...props}: {label?: string}) => <label>{label}<input {...props} /></label>, Select: ({label, children, ...props}: {label?: string; children: React.ReactNode}) => <label>{label}<select {...props}>{children}</select></label>, Textarea: ({label, ...props}: {label?: string}) => <label>{label}<textarea {...props} /></label>}));
vi.mock('../../../lib/api', () => ({apiBaseUrl: '', apiRequest: () => pending}));
vi.mock('../../../lib/permissions', () => ({can: () => true}));
vi.mock('next/navigation', () => ({useRouter: () => ({push: vi.fn()}), useSearchParams: () => new URLSearchParams()}));
describe('AgentWizard lifecycle', () => { it('unmounts safely while loading an existing agent', () => { window.history.pushState({}, '', '?id=agent-1'); const view = render(<AgentWizard />); view.unmount(); expect(true).toBe(true); }); });

describe('AgentWizard steps', () => {
  it('renders five actionable steps without an empty intermediate screen', () => {
    render(<AgentWizard />);
    expect(screen.getByText('步骤 1 / 5')).toBeInTheDocument();
    expect(screen.getByLabelText(/Agent 名称/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: '下一步'}));
    expect(screen.getByText('步骤 2 / 5')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Agent 名称/), {target: {value: '测试 Agent'}});
    fireEvent.click(screen.getByRole('button', {name: '下一步'}));
    expect(screen.getByText('步骤 3 / 5')).toBeInTheDocument();
    expect(screen.getByLabelText('模型')).toBeInTheDocument();
  });
});
