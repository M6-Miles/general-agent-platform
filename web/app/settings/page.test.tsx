import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import SettingsPage from './page';

const request = vi.fn();
const push = vi.fn();
const notify = vi.fn();
const router = {push};
vi.mock('next/navigation', () => ({useRouter: () => router}));
vi.mock('../components/AuthProvider', () => ({useAuth: () => ({token: 'token', user: {role: 'admin'}, logout: vi.fn()})}));
vi.mock('../components/NotificationProvider', () => ({useNotifier: () => notify, useConfirm: () => vi.fn()}));
vi.mock('../components/Workspace', () => ({default: ({children}: {children: React.ReactNode}) => <main>{children}</main>}));
vi.mock('../../lib/api', () => ({apiBaseUrl: '', apiRequest: (...args: unknown[]) => request(...args)}));

describe('SettingsPage user settings', () => {
  beforeEach(() => {
    request.mockReset();
    notify.mockReset();
    localStorage.clear();
    request.mockResolvedValue({data: {id: 'user-1', email: 'admin@example.com', display_name: 'Demo Admin', role: 'admin', preferences: {language: 'zh', timezone: 'Asia/Shanghai', email_notifications: true}}});
  });

  it('renders user settings tabs', async () => {
    render(<SettingsPage />);
    await waitFor(() => expect(screen.getByRole('tab', {name: '个人资料'})).toBeInTheDocument());
    expect(screen.getByRole('tab', {name: '安全设置'})).toBeInTheDocument();
    expect(screen.getByRole('tab', {name: '偏好设置'})).toBeInTheDocument();
  });

  it('switches between tabs', async () => {
    render(<SettingsPage />);
    await waitFor(() => expect(screen.getByRole('tab', {name: '个人资料'})).toBeInTheDocument());

    const securityTab = screen.getByRole('tab', {name: '安全设置'});
    fireEvent.click(securityTab);
    expect(screen.getByText('当前密码')).toBeInTheDocument();
    expect(screen.getByText('新密码')).toBeInTheDocument();

    const preferencesTab = screen.getByRole('tab', {name: '偏好设置'});
    fireEvent.click(preferencesTab);
    expect(screen.getByText('界面语言')).toBeInTheDocument();
  });

  it('saves profile changes through the profile API', async () => {
    render(<SettingsPage />);
    const name = await screen.findByDisplayValue('Demo Admin');
    fireEvent.change(name, {target: {value: '本地演示管理员'}});
    fireEvent.click(screen.getByRole('button', {name: '保存更改'}));
    await waitFor(() => expect(request).toHaveBeenCalledWith('', '/api/v1/settings/profile', 'token', expect.objectContaining({method: 'PUT'})));
    expect(notify).toHaveBeenCalledWith('个人资料已保存', 'success');
  });

  it('requires an explicit save before applying a language preference', async () => {
    render(<SettingsPage />);
    await screen.findByDisplayValue('Demo Admin');
    fireEvent.click(screen.getByRole('tab', {name: '偏好设置'}));
    fireEvent.change(screen.getByLabelText('界面语言'), {target: {value: 'en'}});
    expect(screen.getByRole('heading', {name: '个人设置'})).toBeInTheDocument();
    expect(localStorage.getItem('preferred-language')).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: '保存偏好'}));
    await waitFor(() => expect(notify).toHaveBeenCalledWith('偏好设置已保存', 'success'));
    expect(localStorage.getItem('preferred-language')).toBe('en');
    expect(await screen.findByRole('heading', {name: 'User Settings'})).toBeInTheDocument();
  });

  it('submits a valid password change and clears the form', async () => {
    render(<SettingsPage />);
    await screen.findByDisplayValue('Demo Admin');
    fireEvent.click(screen.getByRole('tab', {name: '安全设置'}));
    fireEvent.change(screen.getByLabelText('当前密码'), {target: {value: 'ChangeMe123456!'}});
    fireEvent.change(screen.getByLabelText(/^新密码/), {target: {value: 'NewPassword123!'}});
    fireEvent.change(screen.getByLabelText(/^确认新密码/), {target: {value: 'NewPassword123!'}});
    fireEvent.click(screen.getByRole('button', {name: '更新密码'}));
    await waitFor(() => expect(request).toHaveBeenCalledWith('', '/api/v1/settings/password', 'token', expect.objectContaining({method: 'PUT'})));
    expect(notify).toHaveBeenCalledWith('密码已更新，请使用新密码登录', 'success');
    expect(screen.getByLabelText('当前密码')).toHaveValue('');
  });
});
