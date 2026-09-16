import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CostsPage from "./page";
const request = vi.fn();
vi.mock("../components/AuthProvider", () => ({ useAuth: () => ({ token: "token" }) }));
vi.mock("../components/Workspace", () => ({ default: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("../../lib/api", () => ({ apiBaseUrl: "", apiRequest: (...args: unknown[]) => request(...args) }));
describe("CostsPage", () => { beforeEach(() => { request.mockReset(); request.mockResolvedValueOnce({ data: { run_count: 3, total_cost_usd: 1.25, total_tokens: 100, completed: 2, failed: 1 } }).mockResolvedValueOnce({ data: { run_count: 3, active_runs: 1, total_tokens: 100, cost_usd: 1.25 } }); }); it("renders cost summary", async () => { render(<CostsPage />); await waitFor(() => expect(screen.getAllByText("$1.2500").length).toBe(2)); expect(screen.getByText("Token 消耗")).toBeInTheDocument(); }); });
