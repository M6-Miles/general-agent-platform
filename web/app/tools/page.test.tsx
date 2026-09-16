import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ToolsPage from "./page";

const request = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("../components/AuthProvider", () => ({ useAuth: () => ({ token: "token", user: { role: "tenant_admin" } }) }));
vi.mock("../components/NotificationProvider", () => ({ useNotifier: () => vi.fn() }));
vi.mock("../components/PlatformHeader", () => ({ default: () => <div>Header</div> }));
vi.mock("../../lib/api", () => ({ apiBaseUrl: "", apiRequest: (...args: unknown[]) => request(...args) }));
vi.mock("../../lib/permissions", () => ({ can: () => true }));
vi.mock("../../lib/labels", () => ({ displayLabel: (value: string) => value }));

describe("ToolsPage", () => {
  beforeEach(() => { request.mockReset(); request.mockResolvedValue({ data: [{ id: "t-1", name: "订单查询", description: "查询订单", executor: "http.orders", risk_level: "medium", version: 1, status: "active", timeout_ms: 5000 }] }); });
  it("loads and displays tools list", async () => {
    render(<ToolsPage />);
    await waitFor(() => expect(screen.getByText("订单查询")).toBeInTheDocument(), { timeout: 3000 });
    await waitFor(() => expect(screen.getByText("查询订单")).toBeInTheDocument(), { timeout: 1000 });
  });
});
