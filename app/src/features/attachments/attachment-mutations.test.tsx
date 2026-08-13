import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/http/api-error";
import { createQueryClient } from "@/lib/query/query-client";
import { attachmentsClient } from "./attachment-client";
import { attachmentKeys } from "./attachment-keys";
import {
  useCreateTaskLink,
  useRemoveTaskAttachment,
  useUploadTaskFile,
} from "./attachment-mutations";

const output = {
  id: "file-1",
  companyId: "company-a",
  owner: { type: "TASK" as const, taskId: "task-a" },
  kind: "FILE" as const,
  title: "File",
  fileName: "file.pdf",
  mimeType: "application/pdf",
  checksum: "a".repeat(64),
  sizeBytes: 4,
  url: null,
  createdBy: "user-a",
  createdAt: "2026-01-01T00:00:00.000Z",
};
const linkOutput = {
  ...output,
  id: "link-1",
  kind: "LINK" as const,
  title: "Docs",
  fileName: null,
  mimeType: null,
  checksum: null,
  sizeBytes: null,
  url: "https://example.com/docs",
};

describe("useUploadTaskFile", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("envia, invalida somente a task e bloqueia duplicidade", async () => {
    const client = createQueryClient();
    const upload = vi.spyOn(attachmentsClient, "uploadTaskFile").mockResolvedValue(output);
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useUploadTaskFile("company-a", "task-a"), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    const file = new File(["file"], "file.pdf", { type: "application/pdf" });
    act(() => {
      expect(result.current.upload(file, "Title")).toBe(true);
      expect(result.current.upload(file, "Title")).toBe(false);
    });
    await waitFor(() => expect(upload).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: attachmentKeys.task("company-a", "task-a"),
      }),
    );
  });

  it("repassa signal e aborta silenciosamente", async () => {
    let signal: AbortSignal | null | undefined;
    vi.spyOn(attachmentsClient, "uploadTaskFile").mockImplementation(
      (_c, _t, _f, _title, options) => {
        signal = options?.signal;
        return new Promise(() => undefined);
      },
    );
    const { result, unmount } = renderHook(() => useUploadTaskFile("company-a", "task-a"), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>
      ),
    });
    act(() => result.current.upload(new File(["file"], "file.pdf"), ""));
    await waitFor(() => expect(signal).toBeDefined());
    unmount();
    expect(signal?.aborted).toBe(true);
    expect(result.current?.error).toBeNull();
  });

  it.each([400, 403, 404, 413, 422, 500])("preserva erro HTTP %s", async (status) => {
    vi.spyOn(attachmentsClient, "uploadTaskFile").mockRejectedValue(
      new ApiError({ status, code: "ERROR", message: "falha" }),
    );
    const { result } = renderHook(() => useUploadTaskFile("company-a", "task-a"), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>
      ),
    });
    act(() => result.current.upload(new File(["file"], "file.pdf"), ""));
    await waitFor(() => expect(result.current.error).toBeTruthy());
  });
});

describe("useCreateTaskLink", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("cria o link, invalida somente a task e bloqueia duplicidade", async () => {
    const client = createQueryClient();
    const create = vi.spyOn(attachmentsClient, "createTaskLink").mockResolvedValue(linkOutput);
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useCreateTaskLink("company-a", "task-a"), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    act(() => {
      expect(result.current.create("https://example.com", "Docs")).toBe(true);
      expect(result.current.create("https://example.com", "Docs")).toBe(false);
    });
    await waitFor(() => expect(create).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: attachmentKeys.task("company-a", "task-a"),
      }),
    );
  });

  it("aborta no desmontar e ignora cancelamento", async () => {
    let signal: AbortSignal | null | undefined;
    vi.spyOn(attachmentsClient, "createTaskLink").mockImplementation((_c, _t, _input, options) => {
      signal = options?.signal;
      return new Promise(() => undefined);
    });
    const { result, unmount } = renderHook(() => useCreateTaskLink("company-a", "task-a"), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>
      ),
    });
    act(() => result.current.create("https://example.com", "Docs"));
    await waitFor(() => expect(signal).toBeDefined());
    unmount();
    expect(signal?.aborted).toBe(true);
  });

  it("ignora sucesso quando o signal aborta durante a invalidação", async () => {
    const client = createQueryClient();
    let resolveInvalidation: (() => void) | undefined;
    vi.spyOn(attachmentsClient, "remove").mockResolvedValue({ id: "file-1" });
    vi.spyOn(client, "invalidateQueries").mockImplementation(
      () => new Promise<void>((resolve) => (resolveInvalidation = resolve)),
    );
    const { result } = renderHook(() => useRemoveTaskAttachment("company-a", "task-a"), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    act(() => result.current.remove("file-1"));
    await waitFor(() => expect(resolveInvalidation).toBeDefined());
    act(() => result.current.abort());
    act(() => resolveInvalidation?.());
    await waitFor(() => expect(result.current.success["file-1"]).toBeUndefined());
  });

  it.each([400, 403, 404, 422, 500])("expõe erro HTTP %s", async (status) => {
    vi.spyOn(attachmentsClient, "createTaskLink").mockRejectedValue(
      new ApiError({ status, code: "ERROR", message: "falha" }),
    );
    const { result } = renderHook(() => useCreateTaskLink("company-a", "task-a"), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>
      ),
    });
    act(() => result.current.create("https://example.com", "Docs"));
    await waitFor(() => expect(result.current.error).toBeTruthy());
  });
});

describe("useRemoveTaskAttachment", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("remove FILE/LINK independentemente e invalida somente a Task", async () => {
    const client = createQueryClient();
    const remove = vi
      .spyOn(attachmentsClient, "remove")
      .mockImplementation(async (_companyId, _taskId, attachmentId) => ({ id: attachmentId }));
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useRemoveTaskAttachment("company-a", "task-a"), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    act(() => {
      expect(result.current.remove("file-1")).toBe(true);
      expect(result.current.remove("file-1")).toBe(false);
      expect(result.current.remove("link-1")).toBe(true);
    });
    await waitFor(() => expect(remove).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(2));
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: attachmentKeys.task("company-a", "task-a"),
    });
  });

  it("aborta no desmontar e ignora cancelamento", async () => {
    let signal: AbortSignal | null | undefined;
    vi.spyOn(attachmentsClient, "remove").mockImplementation((_c, _t, _id, options) => {
      signal = options?.signal;
      return new Promise(() => undefined);
    });
    const { result, unmount } = renderHook(() => useRemoveTaskAttachment("company-a", "task-a"), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>
      ),
    });
    act(() => result.current.remove("file-1"));
    await waitFor(() => expect(signal).toBeDefined());
    unmount();
    expect(signal?.aborted).toBe(true);
  });

  it.each([403, 404, 409, 422, 500])("expõe erro HTTP %s", async (status) => {
    vi.spyOn(attachmentsClient, "remove").mockRejectedValue(
      new ApiError({ status, code: "ERROR", message: "falha" }),
    );
    const { result } = renderHook(() => useRemoveTaskAttachment("company-a", "task-a"), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>
      ),
    });
    act(() => result.current.remove("file-1"));
    await waitFor(() => expect(result.current.errors["file-1"]).toBeTruthy());
  });
});
