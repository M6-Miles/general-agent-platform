import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import KnowledgeDetailPage from "./page";

const request = vi.fn();
const push = vi.fn();
const router = { push };
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "kb-1" }), useRouter: () => router }));
vi.mock("../../components/AuthProvider", () => ({ useAuth: () => ({ token: "token" }) }));
vi.mock("../../components/NotificationProvider", () => ({ useNotifier: () => vi.fn(), useConfirm: () => vi.fn().mockResolvedValue(true) }));
vi.mock("../../components/PlatformHeader", () => ({ default: () => <div>Header</div> }));
vi.mock("../../../lib/api", () => ({ apiBaseUrl: "", apiRequest: (...args: unknown[]) => request(...args) }));

describe("KnowledgeDetailPage", () => {
  beforeEach(() => {
    request.mockReset();
    request.mockResolvedValue({ data: { id: "kb-1", name: "演示库", slug: "demo", description: "说明", created_at: "2026-01-01T00:00:00Z", document_count: 1, documents: [{ id: "doc-1", filename: "guide.txt", content_type: "text/plain", status: "processed", created_at: "2026-01-01T00:00:00Z", chunks_count: 5 }] } });
  });

  it("shows documents and deletes a document after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(window, "alert").mockImplementation(() => {});
    render(<KnowledgeDetailPage />);
    await waitFor(() => expect(screen.getByText("guide.txt")).toBeInTheDocument(), { timeout: 3000 });
    await waitFor(() => expect(screen.getByText("text/plain")).toBeInTheDocument(), { timeout: 1000 });
    const deleteButtons = screen.getAllByRole("button", { name: "删除" });
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);
    await waitFor(() => expect(request).toHaveBeenCalledWith("", "/api/v1/knowledge-bases/kb-1/documents/doc-1", "token", expect.objectContaining({ method: "DELETE" })));
  });
});
