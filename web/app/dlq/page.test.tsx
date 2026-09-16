import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DlqPage from "./page";
const request = vi.fn().mockResolvedValue({ data: [{ message_id: "1-0", run_id: "run-1", source_id: "worker", error: "timeout" }] });
vi.mock("../components/AuthProvider", () => ({ useAuth: () => ({ token: "token" }) }));
vi.mock("../components/NotificationProvider", () => ({ useNotifier: () => vi.fn() }));
vi.mock("../components/Workspace", () => ({ default: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("../../lib/api", () => ({ apiBaseUrl: "", apiRequest: (...args: unknown[]) => request(...args) }));
describe("DlqPage", () => { it("shows failed message and replays it", async () => { render(<DlqPage />); await waitFor(() => expect(screen.getByText("timeout")).toBeInTheDocument()); fireEvent.click(screen.getByRole("button", { name: "重放" })); await waitFor(() => expect(request).toHaveBeenCalledWith("", "/api/v1/dlq/1-0/replay", "token", expect.objectContaining({ method: "POST" }))); }); });
