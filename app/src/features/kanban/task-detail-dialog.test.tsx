import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { attachmentsClient } from "@/features/attachments/attachment-client";
import type { AttachmentOutput } from "@/features/attachments/attachment-contracts";
import type { TaskCard, TaskDetail } from "@/features/tasks/task-contracts";
import { ApiError } from "@/lib/http/api-error";
import { createQueryClient } from "@/lib/query/query-client";
import { TaskDetailDialog } from "./task-detail-dialog";

const task: TaskCard = {
  id: "task-1",
  companyId: "company-a",
  requisitionId: null,
  title: "Tarefa de teste",
  description: "Descrição da tarefa",
  priority: "HIGH",
  status: "DONE",
  assigneeId: "user-1",
  startDate: null,
  plannedEndDate: null,
  completedAt: "2026-02-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  assignee: { id: "user-1", name: "Ana" },
  requisition: null,
};

const detail: TaskDetail = {
  ...task,
  history: [
    {
      id: "hist-1",
      taskId: "task-1",
      fromStatus: null,
      toStatus: "TODO",
      changedBy: "user-1",
      changedAt: "2026-01-01T00:00:00.000Z",
      metadata: null,
    },
    {
      id: "hist-2",
      taskId: "task-1",
      fromStatus: "TODO",
      toStatus: "DONE",
      changedBy: "user-1",
      changedAt: "2026-02-01T00:00:00.000Z",
      metadata: null,
    },
  ],
};

const queryState = {
  isPending: false,
  isError: false,
  data: null as TaskDetail | null,
  error: null as Error | null,
  refetch: vi.fn(),
};

const attachmentsQueryState = {
  isPending: false,
  isError: false,
  data: [] as AttachmentOutput[],
  error: null as Error | null,
  refetch: vi.fn(),
};
const capabilitiesState = {
  isSuccess: true,
  data: {
    companyId: "company-a",
    capabilities: {
      "tasks.create": true,
      "tasks.update": true,
      "kanban.manage": true,
      "users.read": true,
      "requisitions.read": true,
    },
  },
};

vi.mock("@/features/tasks/task-queries", () => ({
  useTaskDetail: () => ({ ...queryState }),
}));
vi.mock("@/features/attachments/attachment-queries", () => ({
  useTaskAttachments: () => ({ ...attachmentsQueryState }),
}));
vi.mock("@/features/attachments/attachment-client", () => ({
  attachmentsClient: { downloadTaskFile: vi.fn(), remove: vi.fn() },
}));
vi.mock("@/features/companies/capabilities-queries", () => ({
  useCompanyCapabilities: () => capabilitiesState,
}));
vi.mock("@/features/attachments/attachment-mutations", () => ({
  useUploadTaskFile: () => ({
    upload: vi.fn(() => true),
    abort: vi.fn(),
    isPending: false,
    isSuccess: false,
    error: null,
  }),
  useCreateTaskLink: () => ({
    create: vi.fn(() => true),
    abort: vi.fn(),
    isPending: false,
    isSuccess: false,
    error: null,
  }),
  useRemoveTaskAttachment: () => ({
    remove: vi.fn(() => true),
    abort: vi.fn(),
    pending: {},
    errors: {},
    success: {},
  }),
}));

function renderDialog(props: Partial<React.ComponentProps<typeof TaskDetailDialog>> = {}) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <TaskDetailDialog
        companyId="company-a"
        task={task}
        isOpen={true}
        onClose={vi.fn()}
        {...props}
      />
      ,
    </QueryClientProvider>,
  );
}

describe("TaskDetailDialog", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    queryState.isPending = false;
    queryState.isError = false;
    queryState.data = null;
    queryState.error = null;
    attachmentsQueryState.isPending = false;
    attachmentsQueryState.isError = false;
    attachmentsQueryState.data = [];
    attachmentsQueryState.error = null;
  });

  it("renderiza loading enquanto carrega", () => {
    queryState.isPending = true;
    renderDialog();
    expect(screen.getByText("Carregando detalhes...")).toBeInTheDocument();
  });

  it("exibe campos e histórico após carregamento", async () => {
    queryState.data = detail;
    renderDialog();
    expect(screen.getByText("Tarefa de teste")).toBeInTheDocument();
    expect(screen.getByText("Descrição da tarefa")).toBeInTheDocument();
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("Concluído")).toBeInTheDocument();
    expect(screen.getByText(/Criação/)).toBeInTheDocument();
    expect(screen.getAllByText(/A fazer/)).toHaveLength(2);
  });

  it("exibe estado vazio quando não há task selecionada", () => {
    renderDialog({ task: null });
    expect(screen.getByText("Nenhuma tarefa selecionada")).toBeInTheDocument();
  });

  it("exibe upload FILE quando tasks.update está autorizado, inclusive DONE", () => {
    queryState.data = detail;
    renderDialog();
    expect(screen.getByLabelText("Arquivo")).toHaveAttribute("type", "file");
    expect(screen.getByRole("button", { name: "Enviar arquivo" })).toBeDisabled();
  });

  it("exibe formulário LINK, valida campos e preserva valores após erro", async () => {
    queryState.data = detail;
    renderDialog();
    const url = screen.getByLabelText("URL");
    const title = screen.getByLabelText("Título", { selector: "input" });
    await userEvent.setup().type(url, "not-a-url");
    await userEvent.setup().type(title, "Documentação");
    const invalidLinkForm = screen.getByRole("button", { name: "Adicionar link" }).closest("form");
    if (!invalidLinkForm) throw new Error("Formulário de link não encontrado");
    fireEvent.submit(invalidLinkForm);
    expect(screen.getByRole("alert")).toHaveTextContent("URL HTTP ou HTTPS válida");
    expect(url).toHaveValue("not-a-url");
    expect(title).toHaveValue("Documentação");
  });

  it("não exibe criação de LINK sem tasks.update", () => {
    capabilitiesState.data.capabilities["tasks.update"] = false;
    queryState.data = detail;
    renderDialog();
    expect(screen.queryByRole("button", { name: "Adicionar link" })).not.toBeInTheDocument();
    capabilitiesState.data.capabilities["tasks.update"] = true;
  });

  it("exige título antes de criar LINK", async () => {
    queryState.data = detail;
    renderDialog();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("URL"), "https://example.com");
    const emptyTitleForm = screen.getByRole("button", { name: "Adicionar link" }).closest("form");
    if (!emptyTitleForm) throw new Error("Formulário de link não encontrado");
    fireEvent.submit(emptyTitleForm);
    expect(screen.getByRole("alert")).toHaveTextContent("Informe um título");
  });

  it("foca no título ao abrir e fecha com Escape restaurando foco", async () => {
    const user = userEvent.setup();
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    queryState.data = detail;
    renderDialog();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Detalhes da tarefa" })).toHaveFocus(),
    );
    await user.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
    document.body.removeChild(trigger);
  });

  it("trata erro 403", () => {
    queryState.isError = true;
    queryState.error = new ApiError({ status: 403, code: "FORBIDDEN", message: "negado" });
    renderDialog();
    expect(screen.getByText(/permissão/)).toBeInTheDocument();
  });

  it("trata erro 404", () => {
    queryState.isError = true;
    queryState.error = new ApiError({ status: 404, code: "NOT_FOUND", message: "não encontrada" });
    renderDialog();
    expect(screen.getByText(/não foi encontrada/)).toBeInTheDocument();
  });

  it("trata erro de rede/5xx", () => {
    queryState.isError = true;
    queryState.error = new TypeError("network");
    renderDialog();
    expect(screen.getByText(/conexão/)).toBeInTheDocument();
  });

  it("chama refetch ao clicar em Tentar novamente", async () => {
    const user = userEvent.setup();
    queryState.isError = true;
    queryState.error = new ApiError({ status: 500, code: "ERROR", message: "erro" });
    renderDialog();
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(queryState.refetch).toHaveBeenCalledOnce();
  });

  it("exibe loading, vazio, erro e retry de attachments", async () => {
    queryState.data = detail;
    attachmentsQueryState.isPending = true;
    renderDialog();
    expect(screen.getByText("Carregando attachments...")).toBeInTheDocument();
    cleanup();

    attachmentsQueryState.isPending = false;
    attachmentsQueryState.isError = true;
    attachmentsQueryState.error = new ApiError({
      status: 403,
      code: "FORBIDDEN",
      message: "negado",
    });
    renderDialog();
    expect(screen.getByText(/permissão para visualizar os attachments/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(attachmentsQueryState.refetch).toHaveBeenCalledOnce();
    cleanup();

    attachmentsQueryState.isError = false;
    attachmentsQueryState.error = null;
    renderDialog();
    expect(screen.getByText("Nenhum attachment")).toBeInTheDocument();
  });

  it("separa FILE e LINK e abre links com segurança", () => {
    queryState.data = detail;
    attachmentsQueryState.data = [
      {
        id: "file-1",
        companyId: "company-a",
        owner: { type: "TASK", taskId: "task-1" },
        kind: "FILE",
        title: "Manual",
        fileName: "manual.pdf",
        mimeType: "application/pdf",
        checksum: "a".repeat(64),
        sizeBytes: 10,
        url: null,
        createdBy: "user-1",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "link-1",
        companyId: "company-a",
        owner: { type: "TASK", taskId: "task-1" },
        kind: "LINK",
        title: "Documentação",
        fileName: null,
        mimeType: null,
        checksum: null,
        sizeBytes: null,
        url: "https://example.com/docs",
        createdBy: "user-1",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    renderDialog();
    expect(screen.getByText("Arquivos")).toBeInTheDocument();
    expect(screen.getByText("Links")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Baixar arquivo" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "https://example.com/docs" })).toHaveAttribute(
      "target",
      "_blank",
    );
    expect(screen.getByRole("link", { name: "https://example.com/docs" })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
    expect(screen.getAllByRole("button", { name: "Remover attachment" })).toHaveLength(2);
  });

  it("confirma remoção acessivelmente e mantém FILE/LINK até sucesso", async () => {
    queryState.data = detail;
    attachmentsQueryState.data = [
      {
        id: "file-1",
        companyId: "company-a",
        owner: { type: "TASK", taskId: "task-1" },
        kind: "FILE",
        title: "Manual",
        fileName: "manual.pdf",
        mimeType: "application/pdf",
        checksum: "a".repeat(64),
        sizeBytes: 10,
        url: null,
        createdBy: "user-1",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    renderDialog();
    await userEvent.setup().click(screen.getByRole("button", { name: "Remover attachment" }));
    expect(screen.getByRole("dialog", { name: "Remover attachment?" })).toBeInTheDocument();
    expect(screen.getByText(/Remover.*Manual/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByText("Manual")).toBeInTheDocument();
  });

  it("mantém foco na confirmação, fecha com Escape e restaura no acionador", async () => {
    queryState.data = detail;
    attachmentsQueryState.data = [
      {
        id: "file-1",
        companyId: "company-a",
        owner: { type: "TASK", taskId: "task-1" },
        kind: "FILE",
        title: "Manual",
        fileName: "manual.pdf",
        mimeType: "application/pdf",
        checksum: "a".repeat(64),
        sizeBytes: 10,
        url: null,
        createdBy: "user-1",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    renderDialog();
    const trigger = screen.getByRole("button", { name: "Remover attachment" });
    await userEvent.setup().click(trigger);
    const confirmation = screen.getByRole("dialog", { name: "Remover attachment?" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus());
    await userEvent.setup().keyboard("{Tab}");
    expect(screen.getByRole("button", { name: "Remover" })).toHaveFocus();
    await userEvent.setup().keyboard("{Tab}");
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
    await userEvent.setup().keyboard("{Escape}");
    await waitFor(() => expect(confirmation).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("não invalida cache quando a remoção é abortada após a resposta", async () => {
    queryState.data = detail;
    attachmentsQueryState.data = [
      {
        id: "file-1",
        companyId: "company-a",
        owner: { type: "TASK", taskId: "task-1" },
        kind: "FILE",
        title: "Manual",
        fileName: "manual.pdf",
        mimeType: "application/pdf",
        checksum: "a".repeat(64),
        sizeBytes: 10,
        url: null,
        createdBy: "user-1",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    renderDialog();
    expect(screen.getByText("Manual")).toBeInTheDocument();
  });

  it("baixa somente após clique, bloqueia duplicidade e revoga a object URL", async () => {
    queryState.data = detail;
    const file: AttachmentOutput[] = [
      {
        id: "file-1",
        companyId: "company-a",
        owner: { type: "TASK", taskId: "task-1" },
        kind: "FILE",
        title: "Manual",
        fileName: "manual.pdf",
        mimeType: "application/pdf",
        checksum: "a".repeat(64),
        sizeBytes: 10,
        url: null,
        createdBy: "user-1",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    attachmentsQueryState.data = file;
    const downloaded = {
      blob: new Blob(["file"], { type: "application/pdf" }),
      fileName: "manual.pdf",
      mimeType: "application/pdf",
    };
    let resolveDownload: (value: typeof downloaded) => void = () => undefined;
    const download = vi
      .mocked(attachmentsClient.downloadTaskFile)
      .mockImplementation(() => new Promise((resolve) => (resolveDownload = resolve)));
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    renderDialog();
    expect(download).not.toHaveBeenCalled();
    const button = screen.getByRole("button", { name: "Baixar arquivo" });
    const user = userEvent.setup();
    await user.click(button);
    expect(await screen.findByRole("button", { name: "Baixando..." })).toBeDisabled();
    await user.click(button);
    expect(download).toHaveBeenCalledOnce();
    resolveDownload(downloaded);
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith("blob:test"));
    expect(createObjectURL).toHaveBeenCalledWith(downloaded.blob);
    expect(file[0]?.kind).toBe("FILE");
  });

  it("permite downloads independentes para attachments diferentes e mostra erro 422", async () => {
    queryState.data = detail;
    attachmentsQueryState.data = [
      {
        id: "file-1",
        companyId: "company-a",
        owner: { type: "TASK", taskId: "task-1" },
        kind: "FILE",
        title: "Um",
        fileName: "um.pdf",
        mimeType: "application/pdf",
        checksum: "a".repeat(64),
        sizeBytes: 1,
        url: null,
        createdBy: "user-1",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "file-2",
        companyId: "company-a",
        owner: { type: "TASK", taskId: "task-1" },
        kind: "FILE",
        title: "Dois",
        fileName: "dois.pdf",
        mimeType: "application/pdf",
        checksum: "b".repeat(64),
        sizeBytes: 1,
        url: null,
        createdBy: "user-1",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    vi.mocked(attachmentsClient.downloadTaskFile)
      .mockRejectedValueOnce(new ApiError({ status: 422, code: "INTEGRITY", message: "falha" }))
      .mockResolvedValueOnce({
        blob: new Blob(["ok"]),
        fileName: "dois.pdf",
        mimeType: "application/pdf",
      });
    renderDialog();
    const buttons = screen.getAllByRole("button", { name: "Baixar arquivo" });
    const firstButton = buttons[0];
    const secondButton = buttons[1];
    if (!firstButton || !secondButton) throw new Error("Botões de download ausentes");
    const user = userEvent.setup();
    await user.click(firstButton);
    await user.click(secondButton);
    expect(await screen.findByText(/integridade deste arquivo/)).toBeInTheDocument();
    expect(vi.mocked(attachmentsClient.downloadTaskFile)).toHaveBeenCalledTimes(2);
  });

  it("passa signal, aborta ao fechar e ignora cancelamento", async () => {
    queryState.data = detail;
    attachmentsQueryState.data = [buildFile("file-1")];
    let resolveDownload: (value: never) => void = () => undefined;
    const download = vi.mocked(attachmentsClient.downloadTaskFile).mockImplementation(
      (_companyId, _taskId, _attachment, options) =>
        new Promise((resolve, reject) => {
          resolveDownload = resolve;
          options?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    const { rerender } = renderDialog();
    await userEvent.setup().click(screen.getByRole("button", { name: "Baixar arquivo" }));
    const signal = download.mock.calls[0]?.[3]?.signal;
    expect(signal).toBeInstanceOf(AbortSignal);
    rerender(
      <QueryClientProvider client={createQueryClient()}>
        <TaskDetailDialog companyId="company-a" task={task} isOpen={false} onClose={vi.fn()} />
      </QueryClientProvider>,
    );
    expect(signal?.aborted).toBe(true);
    resolveDownload(undefined as never);
    await Promise.resolve();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each([
    ["desmontar", "company-a", "task-1"],
    ["trocar companyId", "company-b", "task-1"],
    ["trocar taskId", "company-a", "task-2"],
  ])("aborta ao %s", async (_label, nextCompanyId, nextTaskId) => {
    queryState.data = detail;
    attachmentsQueryState.data = [buildFile("file-1")];
    const download = vi
      .mocked(attachmentsClient.downloadTaskFile)
      .mockImplementation(() => new Promise(() => undefined));
    const view = renderDialog();
    await userEvent.setup().click(screen.getByRole("button", { name: "Baixar arquivo" }));
    const signal = download.mock.calls[0]?.[3]?.signal;
    if (_label === "desmontar") {
      view.unmount();
    } else {
      view.rerender(
        <QueryClientProvider client={createQueryClient()}>
          <TaskDetailDialog
            companyId={nextCompanyId}
            task={{ ...task, id: nextTaskId }}
            isOpen
            onClose={vi.fn()}
          />
        </QueryClientProvider>,
      );
    }
    expect(signal?.aborted).toBe(true);
  });

  it("não cria Blob nem inicia download quando a resposta fica stale", async () => {
    queryState.data = detail;
    attachmentsQueryState.data = [buildFile("file-1")];
    let resolveDownload: (value: { blob: Blob; fileName: string; mimeType: string }) => void = () =>
      undefined;
    vi.mocked(attachmentsClient.downloadTaskFile).mockImplementation(
      () => new Promise((resolve) => (resolveDownload = resolve)),
    );
    const createObjectURL = vi.spyOn(URL, "createObjectURL");
    const view = renderDialog();
    await userEvent.setup().click(screen.getByRole("button", { name: "Baixar arquivo" }));
    view.rerender(
      <QueryClientProvider client={createQueryClient()}>
        <TaskDetailDialog companyId="company-b" task={task} isOpen onClose={vi.fn()} />
      </QueryClientProvider>,
    );
    resolveDownload({
      blob: new Blob(["stale"]),
      fileName: "stale.pdf",
      mimeType: "application/pdf",
    });
    await Promise.resolve();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("revoga object URL quando click falha", async () => {
    queryState.data = detail;
    attachmentsQueryState.data = [buildFile("file-1")];
    vi.mocked(attachmentsClient.downloadTaskFile).mockResolvedValue({
      blob: new Blob(["file"]),
      fileName: "file.pdf",
      mimeType: "application/pdf",
    });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:failed-click");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      throw new Error("click failed");
    });
    renderDialog();
    await userEvent.setup().click(screen.getByRole("button", { name: "Baixar arquivo" }));
    await waitFor(() => expect(revoke).toHaveBeenCalledWith("blob:failed-click"));
  });
});

function buildFile(id: string): AttachmentOutput {
  return {
    id,
    companyId: "company-a",
    owner: { type: "TASK", taskId: "task-1" },
    kind: "FILE",
    title: id,
    fileName: `${id}.pdf`,
    mimeType: "application/pdf",
    checksum: "a".repeat(64),
    sizeBytes: 1,
    url: null,
    createdBy: "user-1",
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}
