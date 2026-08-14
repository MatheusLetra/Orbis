import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { Button } from "@/components/ui/button";
import { attachmentsClient } from "@/features/attachments/attachment-client";
import type { AttachmentOutput } from "@/features/attachments/attachment-contracts";
import {
  useCreateTaskLink,
  useRemoveTaskAttachment,
  useUploadTaskFile,
} from "@/features/attachments/attachment-mutations";
import { useTaskAttachments } from "@/features/attachments/attachment-queries";
import { useAuth } from "@/features/auth/auth-provider";
import { useCompanyCapabilities } from "@/features/companies/capabilities-queries";
import type { TaskCard, TaskDetail, TaskStatus } from "@/features/tasks/task-contracts";
import { useTaskDetail } from "@/features/tasks/task-queries";
import { useTaskTimeEntries } from "@/features/tasks/time-entry-queries";
import { ApiError } from "@/lib/http/api-error";
import { canRegisterTimeEntry, RegisterTimeEntryDialog } from "./register-time-entry-dialog";
import "./task-detail-dialog.css";

const statusLabels: Record<TaskStatus, string> = {
  TODO: "A fazer",
  IN_PROGRESS: "Em andamento",
  PAUSED: "Pausado",
  DONE: "Concluído",
};

const priorityLabels = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
} as const;

interface TaskDetailDialogProps {
  companyId: string;
  task: TaskCard | null;
  isOpen: boolean;
  onClose: () => void;
}

export function TaskDetailDialog({ companyId, task, isOpen, onClose }: TaskDetailDialogProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const previousActiveElement = useRef<Element | null>(null);
  const auth = useAuth();

  const taskId = task?.id ?? null;
  const detailQuery = useTaskDetail(isOpen ? companyId : null, taskId);
  const attachmentsQuery = useTaskAttachments(isOpen ? companyId : null, taskId, isOpen);
  const timeEntriesQuery = useTaskTimeEntries(isOpen ? companyId : null, taskId, {
    enabled: isOpen,
  });
  const capabilitiesQuery = useCompanyCapabilities(isOpen ? companyId : null);
  const upload = useUploadTaskFile(isOpen ? companyId : null, taskId);
  const createLink = useCreateTaskLink(isOpen ? companyId : null, taskId);
  const removeAttachment = useRemoveTaskAttachment(isOpen ? companyId : null, taskId);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<AttachmentOutput | null>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const confirmationTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [downloadPending, setDownloadPending] = useState<Record<string, boolean>>({});
  const [downloadErrors, setDownloadErrors] = useState<Record<string, string | undefined>>({});
  const pendingDownloadsRef = useRef(new Set<string>());
  const downloadControllersRef = useRef(new Map<string, AbortController>());
  const downloadGenerationRef = useRef(0);
  const mountedRef = useRef(true);
  const visualViewport = useVisualViewport(isOpen);

  const abortDownloads = useCallback(() => {
    downloadGenerationRef.current += 1;
    for (const controller of downloadControllersRef.current.values()) controller.abort();
    downloadControllersRef.current.clear();
    pendingDownloadsRef.current.clear();
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: resetar estado ao trocar tenant ou task
  useEffect(() => {
    setDownloadPending({});
    setDownloadErrors({});
    abortDownloads();
    setSelectedFile(null);
    setUploadTitle("");
    setFileError(null);
    setLinkUrl("");
    setLinkTitle("");
    setLinkError(null);
    setConfirmation(null);
  }, [abortDownloads, companyId, taskId]);

  useEffect(() => {
    if (!isOpen) upload.abort();
    if (!isOpen) createLink.abort();
    if (!isOpen) removeAttachment.abort();
    return () => {
      upload.abort();
      createLink.abort();
      removeAttachment.abort();
    };
  }, [createLink.abort, isOpen, removeAttachment.abort, upload.abort]);

  useEffect(() => {
    if (upload.isSuccess) {
      setSelectedFile(null);
      setUploadTitle("");
      setFileError(null);
    }
  }, [upload.isSuccess]);

  function selectFile(file: File | null): void {
    setFileError(null);
    if (file && file.size > 10 * 1024 * 1024) {
      setSelectedFile(null);
      setFileError("O arquivo excede o limite de 10 MB.");
      return;
    }
    setSelectedFile(file);
  }

  function submitUpload(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!selectedFile) {
      setFileError("Selecione um arquivo.");
      return;
    }
    if (upload.upload(selectedFile, uploadTitle)) {
      setFileError(null);
    }
  }

  function submitLink(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const url = linkUrl.trim();
    const title = linkTitle.trim();
    if (!title) {
      setLinkError("Informe um título.");
      return;
    }
    try {
      const parsed = new URL(url);
      if (!/^https?:$/.test(parsed.protocol)) throw new Error("invalid protocol");
    } catch {
      setLinkError("Informe uma URL HTTP ou HTTPS válida.");
      return;
    }
    if (createLink.create(url, title)) setLinkError(null);
  }

  useEffect(() => {
    if (!isOpen) abortDownloads();
    return abortDownloads;
  }, [abortDownloads, isOpen]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortDownloads();
    };
  }, [abortDownloads]);

  async function downloadFile(attachment: AttachmentOutput): Promise<void> {
    if (!taskId || pendingDownloadsRef.current.has(attachment.id)) return;
    const controller = new AbortController();
    const generation = downloadGenerationRef.current;
    pendingDownloadsRef.current.add(attachment.id);
    downloadControllersRef.current.set(attachment.id, controller);
    setDownloadPending((current) => ({ ...current, [attachment.id]: true }));
    setDownloadErrors((current) => ({ ...current, [attachment.id]: undefined }));
    try {
      const downloaded = await attachmentsClient.downloadTaskFile(companyId, taskId, attachment, {
        signal: controller.signal,
      });
      if (
        controller.signal.aborted ||
        generation !== downloadGenerationRef.current ||
        !mountedRef.current ||
        !isOpen
      )
        return;
      const objectUrl = URL.createObjectURL(downloaded.blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = downloaded.fileName;
      document.body.append(link);
      try {
        link.click();
      } finally {
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 100);
      }
    } catch (error) {
      if (
        isAbortError(error) ||
        controller.signal.aborted ||
        generation !== downloadGenerationRef.current
      ) {
        return;
      }
      setDownloadErrors((current) => ({
        ...current,
        [attachment.id]: messageForDownloadError(
          error instanceof Error ? error : new Error("Download error"),
        ),
      }));
    } finally {
      if (downloadControllersRef.current.get(attachment.id) === controller) {
        downloadControllersRef.current.delete(attachment.id);
        pendingDownloadsRef.current.delete(attachment.id);
        if (mountedRef.current) {
          setDownloadPending((current) => ({ ...current, [attachment.id]: false }));
        }
      }
    }
  }

  const close = useCallback(() => {
    abortDownloads();
    window.setTimeout(() => {
      const previous = previousActiveElement.current;
      if (previous instanceof HTMLElement) previous.focus();
      previousActiveElement.current = null;
    }, 0);
    onClose();
  }, [abortDownloads, onClose]);

  useEffect(() => {
    if (createLink.isSuccess) {
      setLinkUrl("");
      setLinkTitle("");
      setLinkError(null);
      close();
    }
  }, [close, createLink.isSuccess]);

  useEffect(() => {
    if (!confirmation) return;
    if (removeAttachment.success[confirmation.id]) {
      setConfirmation(null);
      return;
    }
    window.setTimeout(() => {
      const dialog = confirmationRef.current;
      if (!dialog) return;
      dialog.focus();
      const firstControl = dialog.querySelector<HTMLElement>(
        "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
      );
      firstControl?.focus();
    }, 0);
  }, [confirmation, removeAttachment.success]);

  useEffect(() => {
    if (!confirmation) return;
    const dialog = confirmationRef.current;
    if (!dialog) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setConfirmation(null);
        return;
      }
      if (event.key !== "Tab") return;
      event.stopPropagation();
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
        ),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener("keydown", onKeyDown);
    return () => dialog.removeEventListener("keydown", onKeyDown);
  }, [confirmation]);

  useEffect(() => {
    if (confirmation) return;
    const trigger = confirmationTriggerRef.current;
    if (trigger) {
      window.setTimeout(() => trigger.focus(), 0);
      confirmationTriggerRef.current = null;
    }
  }, [confirmation]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reabrir/refocar ao trocar de task
  useEffect(() => {
    if (!isOpen) return;

    previousActiveElement.current = document.activeElement;
    window.setTimeout(() => titleRef.current?.focus(), 0);
  }, [isOpen, taskId]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const modal = modalRef.current;
    if (!modal?.contains(event.target as Node)) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      modal.querySelectorAll<HTMLElement>(
        "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
      ),
    );
    const first = titleRef.current ?? focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) {
      event.preventDefault();
      titleRef.current?.focus();
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const detail = detailQuery.data;

  if (!isOpen) return null;

  return createPortal(
    <div
      className="task-detail-backdrop"
      data-testid="task-detail-backdrop"
      style={{
        position: "fixed",
        left: visualViewport.left,
        top: visualViewport.top,
        right: "auto",
        bottom: "auto",
        boxSizing: "border-box",
        width: visualViewport.width,
        height: visualViewport.height,
        padding: 8,
        overflow: "hidden",
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-detail-title"
        className="task-detail-modal"
        data-testid="task-detail-modal"
        style={{
          boxSizing: "border-box",
          width: "100%",
          minWidth: 0,
          maxWidth: "48rem",
          height: "100%",
          minHeight: 0,
          maxHeight: "calc(100dvh - 16px)",
          overflow: "hidden",
        }}
        onKeyDown={handleKeyDown}
      >
        <header className="task-detail-header">
          <h2
            id="task-detail-title"
            ref={titleRef}
            tabIndex={-1}
            className="min-w-0 break-words text-lg font-semibold outline-none"
          >
            Detalhes da tarefa
          </h2>
        </header>
        <main
          className="task-detail-main"
          data-testid="task-detail-scroll"
          style={{ minHeight: 0, minWidth: 0, overflowX: "hidden", overflowY: "auto" }}
        >
          {detailQuery.isPending && <LoadingState label="Carregando detalhes..." />}
          {detailQuery.isError && (
            <ErrorState
              message={messageForDetailError(detailQuery.error)}
              onRetry={() => void detailQuery.refetch()}
            />
          )}
          {!detailQuery.isPending && !detailQuery.isError && detail && (
            <TaskDetailContent
              task={task}
              companyId={companyId}
              isOpen={isOpen}
              detail={detail}
              attachmentsQuery={attachmentsQuery}
              timeEntriesQuery={timeEntriesQuery}
              canRegisterTimeEntry={canRegisterTimeEntry(
                task,
                capabilitiesQuery.isSuccess ? capabilitiesQuery.data : undefined,
                companyId,
                auth.user?.id,
                auth.status === "authenticated",
              )}
              onCapabilitiesForbidden={() => void capabilitiesQuery.refetch()}
              downloadPending={downloadPending}
              downloadErrors={downloadErrors}
              onDownload={downloadFile}
              canUpload={
                capabilitiesQuery.isSuccess &&
                capabilitiesQuery.data.capabilities["tasks.update"] === true
              }
              selectedFile={selectedFile}
              uploadTitle={uploadTitle}
              fileError={fileError}
              uploadError={upload.error}
              uploadPending={upload.isPending}
              onFileChange={selectFile}
              onTitleChange={setUploadTitle}
              onUpload={submitUpload}
              linkUrl={linkUrl}
              linkTitle={linkTitle}
              linkError={linkError}
              createLinkError={createLink.error}
              createLinkPending={createLink.isPending}
              onLinkUrlChange={setLinkUrl}
              onLinkTitleChange={setLinkTitle}
              onCreateLink={submitLink}
              canRemove={
                capabilitiesQuery.isSuccess &&
                capabilitiesQuery.data.capabilities["tasks.update"] === true
              }
              removePending={removeAttachment.pending}
              removeErrors={removeAttachment.errors}
              onRequestRemove={(attachment, trigger) => {
                confirmationTriggerRef.current = trigger;
                setConfirmation(attachment);
              }}
            />
          )}
          {!detailQuery.isPending && !detailQuery.isError && !detail && (
            <EmptyState title="Nenhuma tarefa selecionada" />
          )}
        </main>
        <footer className="task-detail-footer" data-testid="task-detail-footer">
          <Button type="button" variant="outline" onClick={close}>
            Fechar
          </Button>
        </footer>
        {confirmation && (
          <div
            ref={confirmationRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-attachment-title"
            tabIndex={-1}
            className="task-detail-confirmation-backdrop"
          >
            <div className="task-detail-confirmation">
              <h2 id="remove-attachment-title" className="text-base font-semibold">
                Remover attachment?
              </h2>
              <p className="mt-2 break-words text-sm text-muted-foreground">
                Remover "{confirmation.title ?? confirmation.fileName ?? "Sem título"}"? Esta ação
                não pode ser desfeita.
              </p>
              {removeAttachment.errors[confirmation.id] && (
                <p role="alert" className="mt-3 break-words text-sm text-destructive">
                  {removeAttachment.errors[confirmation.id]}
                </p>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setConfirmation(null)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={removeAttachment.pending[confirmation.id]}
                  aria-busy={removeAttachment.pending[confirmation.id]}
                  onClick={() => void removeAttachment.remove(confirmation.id)}
                >
                  {removeAttachment.pending[confirmation.id] ? "Removendo..." : "Remover"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function TaskDetailContent({
  task,
  companyId,
  isOpen,
  detail,
  attachmentsQuery,
  timeEntriesQuery,
  canRegisterTimeEntry: canRegister,
  onCapabilitiesForbidden,
  downloadPending,
  downloadErrors,
  onDownload,
  canUpload,
  selectedFile,
  uploadTitle,
  fileError,
  uploadError,
  uploadPending,
  onFileChange,
  onTitleChange,
  onUpload,
  linkUrl,
  linkTitle,
  linkError,
  createLinkError,
  createLinkPending,
  onLinkUrlChange,
  onLinkTitleChange,
  onCreateLink,
  canRemove,
  removePending,
  removeErrors,
  onRequestRemove,
}: {
  task: TaskCard | null;
  companyId: string;
  isOpen: boolean;
  detail: TaskDetail;
  attachmentsQuery: ReturnType<typeof useTaskAttachments>;
  timeEntriesQuery: ReturnType<typeof useTaskTimeEntries>;
  canRegisterTimeEntry: boolean;
  onCapabilitiesForbidden: () => void;
  downloadPending: Record<string, boolean>;
  downloadErrors: Record<string, string | undefined>;
  onDownload: (attachment: AttachmentOutput) => Promise<void>;
  canUpload: boolean;
  selectedFile: File | null;
  uploadTitle: string;
  fileError: string | null;
  uploadError: string | null;
  uploadPending: boolean;
  onFileChange: (file: File | null) => void;
  onTitleChange: (title: string) => void;
  onUpload: (event: React.FormEvent<HTMLFormElement>) => void;
  linkUrl: string;
  linkTitle: string;
  linkError: string | null;
  createLinkError: string | null;
  createLinkPending: boolean;
  onLinkUrlChange: (url: string) => void;
  onLinkTitleChange: (title: string) => void;
  onCreateLink: (event: React.FormEvent<HTMLFormElement>) => void;
  canRemove: boolean;
  removePending: Record<string, boolean>;
  removeErrors: Record<string, string | undefined>;
  onRequestRemove: (attachment: AttachmentOutput, trigger: HTMLButtonElement) => void;
}) {
  return (
    <div className="grid min-w-0 gap-6">
      <section>
        <h3 className="break-words text-base font-semibold">{detail.title}</h3>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border px-2 py-1 font-medium">
            Prioridade {priorityLabels[detail.priority]}
          </span>
          <span className="rounded-full border px-2 py-1 font-medium">
            {statusLabels[detail.status]}
          </span>
        </div>
      </section>

      <AttachmentsSection
        query={attachmentsQuery}
        downloadPending={downloadPending}
        downloadErrors={downloadErrors}
        onDownload={onDownload}
        canRemove={canRemove}
        removePending={removePending}
        removeErrors={removeErrors}
        onRequestRemove={onRequestRemove}
      />
      <TimeEntriesSection
        query={timeEntriesQuery}
        task={task}
        companyId={companyId}
        isOpen={isOpen}
        canRegister={canRegister}
        onCapabilitiesForbidden={onCapabilitiesForbidden}
      />
      {canUpload && (
        <div className="grid gap-3">
          <form className="grid gap-3 rounded-lg border border-dashed p-4" onSubmit={onUpload}>
            <h4 className="text-sm font-semibold">Adicionar arquivo</h4>
            <label className="grid gap-1 text-sm font-medium">
              Arquivo
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,application/pdf,image/jpeg,image/png,image/gif,image/webp"
                disabled={uploadPending}
                onChange={(event) => onFileChange(event.currentTarget.files?.[0] ?? null)}
              />
            </label>
            {selectedFile && (
              <p className="text-xs text-muted-foreground">
                {selectedFile.name} · {formatBytes(selectedFile.size)}
              </p>
            )}
            <label className="grid gap-1 text-sm font-medium">
              Título (opcional)
              <input
                className="task-detail-form-control h-9 rounded-md border bg-background px-3 text-sm"
                value={uploadTitle}
                disabled={uploadPending}
                onChange={(event) => onTitleChange(event.currentTarget.value)}
              />
            </label>
            {(fileError || uploadError) && (
              <p role="alert" className="text-sm text-destructive">
                {fileError ?? uploadError}
              </p>
            )}
            <Button type="submit" disabled={uploadPending || !selectedFile}>
              {uploadPending ? "Enviando arquivo..." : "Enviar arquivo"}
            </Button>
          </form>
          <form className="grid gap-3 rounded-lg border border-dashed p-4" onSubmit={onCreateLink}>
            <h4 className="text-sm font-semibold">Adicionar link</h4>
            <label className="grid gap-1 text-sm font-medium">
              URL
              <input
                type="url"
                required
                className="task-detail-form-control h-9 rounded-md border bg-background px-3 text-sm"
                value={linkUrl}
                disabled={createLinkPending}
                onChange={(event) => onLinkUrlChange(event.currentTarget.value)}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Título
              <input
                required
                className="task-detail-form-control h-9 rounded-md border bg-background px-3 text-sm"
                value={linkTitle}
                disabled={createLinkPending}
                onChange={(event) => onLinkTitleChange(event.currentTarget.value)}
              />
            </label>
            {(linkError || createLinkError) && (
              <p role="alert" className="text-sm text-destructive">
                {linkError ?? createLinkError}
              </p>
            )}
            <Button type="submit" disabled={createLinkPending} aria-busy={createLinkPending}>
              {createLinkPending ? "Adicionando link..." : "Adicionar link"}
            </Button>
          </form>
        </div>
      )}

      <dl className="grid gap-3 text-sm">
        <DetailItem label="Descrição">
          {detail.description ? detail.description : "Sem descrição"}
        </DetailItem>
        <DetailItem label="Responsável">
          {task?.assignee?.name ?? (detail.assigneeId ? detail.assigneeId : "Sem responsável")}
        </DetailItem>
        <DetailItem label="Requisition">
          {task?.requisition
            ? `#${task.requisition.number} · ${task.requisition.title}`
            : detail.requisitionId
              ? detail.requisitionId
              : "Sem Requisition"}
        </DetailItem>
        <DetailItem label="Data de início">
          {detail.startDate ? formatDate(detail.startDate) : "Não definida"}
        </DetailItem>
        <DetailItem label="Previsão de término">
          {detail.plannedEndDate ? formatDate(detail.plannedEndDate) : "Não definida"}
        </DetailItem>
        <DetailItem label="Concluída em">
          {detail.completedAt ? formatDate(detail.completedAt) : "Não concluída"}
        </DetailItem>
        <DetailItem label="Criada em">{formatDate(detail.createdAt)}</DetailItem>
        <DetailItem label="Atualizada em">{formatDate(detail.updatedAt)}</DetailItem>
      </dl>

      <section>
        <h4 className="mb-2 text-sm font-semibold">Histórico de status</h4>
        {detail.history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma alteração de status registrada.</p>
        ) : (
          <ol className="grid gap-2">
            {detail.history.map((entry) => (
              <li key={entry.id} className="rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {entry.fromStatus ? statusLabels[entry.fromStatus] : "Criação"} →{" "}
                    {statusLabels[entry.toStatus]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(entry.changedAt)}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function TimeEntriesSection({
  query,
  task,
  companyId,
  isOpen,
  canRegister,
  onCapabilitiesForbidden,
}: {
  query: ReturnType<typeof useTaskTimeEntries>;
  task: TaskCard | null;
  companyId: string;
  isOpen: boolean;
  canRegister: boolean;
  onCapabilitiesForbidden: () => void;
}) {
  const headingId = "task-time-entries-title";
  const errorId = "task-time-entries-error";

  return (
    <section aria-labelledby={headingId}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h4 id={headingId} className="text-sm font-semibold">
          Horas apontadas
        </h4>
        {task && (
          <RegisterTimeEntryDialog
            companyId={companyId}
            task={task}
            isOpen={isOpen}
            canRegister={canRegister}
            onCapabilitiesForbidden={onCapabilitiesForbidden}
          />
        )}
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Horas registradas manualmente. Este total não inclui pausas, estimativas ou capacidade.
      </p>
      {query.isPending && <LoadingState label="Carregando horas apontadas..." />}
      {query.isError && (
        <div id={errorId} aria-live="assertive">
          <ErrorState
            message={messageForTimeEntriesError(query.error)}
            onRetry={() => void query.refetch()}
          />
        </div>
      )}
      {!query.isPending && !query.isError && query.data && (
        <div className="grid gap-3">
          <p className="rounded-md border bg-muted/30 p-3 text-sm">
            <span className="text-muted-foreground">Total registrado: </span>
            <strong>{query.data.totalDurationMinutes} minutos</strong>
          </p>
          {query.data.items.length === 0 ? (
            <EmptyState
              title="Nenhuma hora registrada"
              description="Esta tarefa ainda não possui horas apontadas manualmente."
            />
          ) : (
            <ul className="grid gap-2" aria-label="Entradas de horas apontadas">
              {query.data.items.map((entry) => (
                <li key={entry.id} className="rounded-md border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong>{entry.durationMinutes} minutos</strong>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(entry.createdAt)}
                    </span>
                  </div>
                  {entry.description && <p className="mt-2 break-words">{entry.description}</p>}
                  <p className="mt-2 break-words text-xs text-muted-foreground">
                    Usuário: {entry.userId}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {query.data.hasMore && (
            <p className="text-xs text-muted-foreground" role="status">
              Existem mais entradas de horas. A exibição está limitada às primeiras 100 nesta
              unidade.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function AttachmentsSection({
  query,
  downloadPending,
  downloadErrors,
  onDownload,
  canRemove,
  removePending,
  removeErrors,
  onRequestRemove,
}: {
  query: ReturnType<typeof useTaskAttachments>;
  downloadPending: Record<string, boolean>;
  downloadErrors: Record<string, string | undefined>;
  onDownload: (attachment: AttachmentOutput) => Promise<void>;
  canRemove: boolean;
  removePending: Record<string, boolean>;
  removeErrors: Record<string, string | undefined>;
  onRequestRemove: (attachment: AttachmentOutput, trigger: HTMLButtonElement) => void;
}) {
  return (
    <section>
      <h4 className="mb-3 text-sm font-semibold">Attachments</h4>
      {query.isPending && <LoadingState label="Carregando attachments..." />}
      {query.isError && (
        <ErrorState
          message={messageForAttachmentError(query.error)}
          onRetry={() => void query.refetch()}
        />
      )}
      {!query.isPending && !query.isError && query.data?.length === 0 && (
        <EmptyState title="Nenhum attachment" description="Esta tarefa não possui attachments." />
      )}
      {!query.isPending && !query.isError && query.data && query.data.length > 0 && (
        <div className="grid gap-4">
          <AttachmentGroup
            title="Arquivos"
            items={query.data.filter((item) => item.kind === "FILE")}
            downloadPending={downloadPending}
            downloadErrors={downloadErrors}
            onDownload={onDownload}
            canRemove={canRemove}
            removePending={removePending}
            removeErrors={removeErrors}
            onRequestRemove={onRequestRemove}
          />
          <AttachmentGroup
            title="Links"
            items={query.data.filter((item) => item.kind === "LINK")}
            downloadPending={downloadPending}
            downloadErrors={downloadErrors}
            onDownload={onDownload}
            canRemove={canRemove}
            removePending={removePending}
            removeErrors={removeErrors}
            onRequestRemove={onRequestRemove}
          />
        </div>
      )}
    </section>
  );
}

function AttachmentGroup({
  title,
  items,
  downloadPending,
  downloadErrors,
  onDownload,
  canRemove,
  removePending,
  removeErrors,
  onRequestRemove,
}: {
  title: string;
  items: AttachmentOutput[];
  downloadPending: Record<string, boolean>;
  downloadErrors: Record<string, string | undefined>;
  onDownload: (attachment: AttachmentOutput) => Promise<void>;
  canRemove: boolean;
  removePending: Record<string, boolean>;
  removeErrors: Record<string, string | undefined>;
  onRequestRemove: (attachment: AttachmentOutput, trigger: HTMLButtonElement) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h5 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h5>
      <ul className="grid gap-2">
        {items.map((attachment) => (
          <li key={attachment.id} className="rounded-md border p-3 text-sm">
            <p className="font-medium">{attachment.title ?? attachment.fileName ?? "Sem título"}</p>
            {attachment.kind === "LINK" ? (
              <a
                href={attachment.url ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block break-all text-primary underline"
              >
                {attachment.url}
              </a>
            ) : (
              <>
                <p className="mt-1 break-words text-muted-foreground">
                  {attachment.fileName} · {attachment.mimeType ?? "tipo desconhecido"} ·{" "}
                  {formatBytes(attachment.sizeBytes)}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  disabled={downloadPending[attachment.id]}
                  onClick={() => void onDownload(attachment)}
                >
                  {downloadPending[attachment.id] ? "Baixando..." : "Baixar arquivo"}
                </Button>
                {downloadErrors[attachment.id] && (
                  <p className="mt-2 text-sm text-destructive" role="alert">
                    {downloadErrors[attachment.id]}
                  </p>
                )}
              </>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Criado por {attachment.createdBy} em {formatDate(attachment.createdAt)}
            </p>
            {canRemove && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="mt-2"
                  disabled={removePending[attachment.id]}
                  aria-busy={removePending[attachment.id]}
                  onClick={(event) => onRequestRemove(attachment, event.currentTarget)}
                >
                  {removePending[attachment.id] ? "Removendo..." : "Remover attachment"}
                </Button>
                {removeErrors[attachment.id] && (
                  <p className="mt-2 text-sm text-destructive" role="alert">
                    {removeErrors[attachment.id]}
                  </p>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatBytes(value: number | null): string {
  if (value === null) return "tamanho desconhecido";
  if (value < 1024) return `${value} B`;
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words">{children}</dd>
    </div>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function messageForDetailError(error: Error): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return "Você não tem permissão para visualizar esta tarefa.";
    if (error.status === 404) return "A tarefa não foi encontrada. O board será atualizado.";
    if (error.status >= 500) return "Não foi possível carregar os detalhes. Tente novamente.";
  }
  return "Não foi possível carregar os detalhes. Verifique sua conexão e tente novamente.";
}

function messageForAttachmentError(error: Error): string {
  if (error instanceof ApiError) {
    if (error.status === 403)
      return "Você não tem permissão para visualizar os attachments desta tarefa.";
    if (error.status === 404)
      return "A tarefa não foi encontrada. Os attachments não puderam ser carregados.";
    if (error.status >= 500) return "Não foi possível carregar os attachments. Tente novamente.";
  }
  return "Não foi possível carregar os attachments. Verifique sua conexão e tente novamente.";
}

function messageForTimeEntriesError(error: Error): string {
  if (error instanceof ApiError) {
    if (error.status === 403)
      return "Você não tem permissão para visualizar as horas desta tarefa.";
    if (error.status === 404)
      return "A tarefa não foi encontrada. As horas não puderam ser carregadas.";
    if (error.status >= 500) return "Não foi possível carregar as horas. Tente novamente.";
  }
  return "Não foi possível carregar as horas. Verifique sua conexão e tente novamente.";
}

export function messageForDownloadError(error: Error): string {
  if (error instanceof ApiError) {
    if (error.status === 403)
      return "Você não tem permissão para baixar este arquivo, ou ela foi perdida.";
    if (error.status === 404) return "O attachment ou a tarefa não foi encontrado.";
    if (error.status === 422) return "Não foi possível confirmar a integridade deste arquivo.";
    if (error.status >= 500) return "Não foi possível baixar o arquivo. Tente novamente.";
  }
  return "Não foi possível baixar o arquivo. Verifique sua conexão e tente novamente.";
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function useVisualViewport(enabled: boolean) {
  const [viewport, setViewport] = useState(readVisualViewport);

  useEffect(() => {
    if (!enabled) return;
    const visualViewport = window.visualViewport;
    const update = () => setViewport(readVisualViewport());
    update();
    visualViewport?.addEventListener("resize", update);
    visualViewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      visualViewport?.removeEventListener("resize", update);
      visualViewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [enabled]);

  return viewport;
}

function readVisualViewport() {
  const viewport = window.visualViewport;
  return {
    left: viewport?.offsetLeft ?? 0,
    top: viewport?.offsetTop ?? 0,
    width: viewport?.width ?? window.innerWidth,
    height: viewport?.height ?? window.innerHeight,
  };
}
