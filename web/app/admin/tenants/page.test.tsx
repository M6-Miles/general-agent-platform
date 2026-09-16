import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TenantPage from "./page";
const request = vi.fn().mockResolvedValue({ data: { tenant_id: "tenant", monthly_token_limit: 1000, monthly_cost_limit_usd: 20, max_concurrent_runs: 2, warning_percent: 90, max_requests_per_minute: 60, max_knowledge_documents: 10, max_workflow_runs_per_day: 50, usage: { total_tokens: 10, cost_usd: 1, run_count: 2, active_runs: 0 } } });
vi.mock("../../components/AuthProvider", () => ({ useAuth: () => ({ token: "token", user: { role: "tenant_admin" } }) }));
vi.mock("../../components/NotificationProvider", () => ({ useNotifier: () => vi.fn() }));
vi.mock("../../components/Workspace", () => ({ default: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("../../../lib/api", () => ({ apiBaseUrl: "", apiRequest: (...args: unknown[]) => request(...args) }));
describe("TenantPage", () => { it("loads quota controls", async () => { render(<TenantPage />); await waitFor(() => expect(screen.getByText("租户配额管理")).toBeInTheDocument()); expect(screen.getByDisplayValue("1000")).toBeInTheDocument(); }); });
