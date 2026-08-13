import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/http/api-error";
import { attachmentsClient } from "./attachment-client";
import type { AttachmentOutput } from "./attachment-contracts";
import { attachmentKeys } from "./attachment-keys";

interface UploadVariables {
  companyId: string;
  taskId: string;
  file: File;
  title: string;
  signal: AbortSignal;
  generation: number;
}

interface CreateLinkVariables {
  companyId: string;
  taskId: string;
  url: string;
  title: string;
  signal: AbortSignal;
  generation: number;
}

interface RemoveVariables {
  companyId: string;
  taskId: string;
  attachmentId: string;
  signal: AbortSignal;
  generation: number;
}

export function useUploadTaskFile(companyId: string | null, taskId: string | null) {
  const queryClient = useQueryClient();
  const controllerRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  const mountedRef = useRef(true);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const abort = useCallback((): void => {
    generationRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);
  const mutation = useMutation<AttachmentOutput, Error, UploadVariables>({
    mutationKey: ["attachments", "upload-file"],
    mutationFn: ({ companyId: id, taskId: currentTaskId, file, title, signal }) =>
      attachmentsClient.uploadTaskFile(id, currentTaskId, file, title, { signal }),
    onSuccess: async (_output, variables) => {
      if (
        !mountedRef.current ||
        variables.generation !== generationRef.current ||
        variables.signal.aborted
      )
        return;
      await queryClient.invalidateQueries({
        queryKey: attachmentKeys.task(variables.companyId, variables.taskId),
      });
      if (
        mountedRef.current &&
        variables.generation === generationRef.current &&
        !variables.signal.aborted
      ) {
        setIsSuccess(true);
      }
    },
    onError: (cause, variables) => {
      if (
        isAbortError(cause) ||
        variables.signal.aborted ||
        variables.generation !== generationRef.current
      )
        return;
      setError(messageForUploadError(cause));
      if (cause instanceof ApiError && cause.status === 403) {
        void queryClient.invalidateQueries({
          queryKey: ["company-capabilities", variables.companyId],
        });
      }
    },
    onSettled: (_data, _cause, variables) => {
      if (controllerRef.current?.signal === variables.signal) controllerRef.current = null;
    },
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abort();
    };
  }, [abort]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: lifecycle reset must run when tenant/task changes
  useEffect(() => {
    abort();
    setError(null);
  }, [abort, companyId, taskId]);

  function upload(file: File, title: string): boolean {
    if (!companyId || !taskId || mutation.isPending || controllerRef.current !== null) return false;
    const controller = new AbortController();
    controllerRef.current = controller;
    setError(null);
    setIsSuccess(false);
    mutation.mutate({
      companyId,
      taskId,
      file,
      title,
      signal: controller.signal,
      generation: generationRef.current,
    });
    return true;
  }

  return {
    upload,
    abort,
    isPending: mutation.isPending,
    isSuccess,
    error,
    clearError: () => setError(null),
  };
}

export function useCreateTaskLink(companyId: string | null, taskId: string | null) {
  const queryClient = useQueryClient();
  const controllerRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  const mountedRef = useRef(true);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const abort = useCallback((): void => {
    generationRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);
  const mutation = useMutation<AttachmentOutput, Error, CreateLinkVariables>({
    mutationKey: ["attachments", "create-link"],
    mutationFn: ({ companyId: id, taskId: currentTaskId, url, title, signal }) =>
      attachmentsClient.createTaskLink(id, currentTaskId, { url, title }, { signal }),
    onSuccess: async (_output, variables) => {
      if (
        !mountedRef.current ||
        variables.generation !== generationRef.current ||
        variables.signal.aborted
      )
        return;
      await queryClient.invalidateQueries({
        queryKey: attachmentKeys.task(variables.companyId, variables.taskId),
      });
      if (
        mountedRef.current &&
        variables.generation === generationRef.current &&
        !variables.signal.aborted
      ) {
        setIsSuccess(true);
      }
    },
    onError: (cause, variables) => {
      if (
        isAbortError(cause) ||
        variables.signal.aborted ||
        variables.generation !== generationRef.current
      )
        return;
      setError(messageForLinkError(cause));
      if (cause instanceof ApiError && cause.status === 403) {
        void queryClient.invalidateQueries({
          queryKey: ["company-capabilities", variables.companyId],
        });
      }
    },
    onSettled: (_data, _cause, variables) => {
      if (controllerRef.current?.signal === variables.signal) controllerRef.current = null;
    },
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abort();
    };
  }, [abort]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: lifecycle reset must run when tenant/task changes
  useEffect(() => {
    abort();
    setError(null);
  }, [abort, companyId, taskId]);

  function create(url: string, title: string): boolean {
    if (!companyId || !taskId || mutation.isPending || controllerRef.current !== null) return false;
    const controller = new AbortController();
    controllerRef.current = controller;
    setError(null);
    setIsSuccess(false);
    mutation.mutate({
      companyId,
      taskId,
      url,
      title,
      signal: controller.signal,
      generation: generationRef.current,
    });
    return true;
  }

  return {
    create,
    abort,
    isPending: mutation.isPending,
    isSuccess,
    error,
    clearError: () => setError(null),
  };
}

export function useRemoveTaskAttachment(companyId: string | null, taskId: string | null) {
  const queryClient = useQueryClient();
  const controllersRef = useRef(new Map<string, AbortController>());
  const generationRef = useRef(0);
  const mountedRef = useRef(true);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [success, setSuccess] = useState<Record<string, boolean>>({});
  const abort = useCallback((): void => {
    generationRef.current += 1;
    for (const controller of controllersRef.current.values()) controller.abort();
    controllersRef.current.clear();
    setPending({});
  }, []);
  const mutation = useMutation<{ id: string }, Error, RemoveVariables>({
    mutationKey: ["attachments", "remove"],
    mutationFn: ({ companyId: id, taskId: currentTaskId, attachmentId, signal }) =>
      attachmentsClient.remove(id, currentTaskId, attachmentId, { signal }),
    onSuccess: async (_output, variables) => {
      if (
        !mountedRef.current ||
        variables.generation !== generationRef.current ||
        variables.signal.aborted
      )
        return;
      await queryClient.invalidateQueries({
        queryKey: attachmentKeys.task(variables.companyId, variables.taskId),
      });
      if (
        mountedRef.current &&
        variables.generation === generationRef.current &&
        !variables.signal.aborted
      ) {
        setSuccess((current) => ({ ...current, [variables.attachmentId]: true }));
      }
    },
    onError: (cause, variables) => {
      if (
        isAbortError(cause) ||
        variables.signal.aborted ||
        variables.generation !== generationRef.current
      )
        return;
      if (cause instanceof ApiError && (cause.status === 404 || cause.status === 409)) {
        void queryClient.invalidateQueries({
          queryKey: attachmentKeys.task(variables.companyId, variables.taskId),
        });
      }
      if (cause instanceof ApiError && cause.status === 403) {
        void queryClient.invalidateQueries({
          queryKey: ["company-capabilities", variables.companyId],
        });
      }
      setErrors((current) => ({
        ...current,
        [variables.attachmentId]: messageForRemoveError(cause),
      }));
    },
    onSettled: (_data, _cause, variables) => {
      if (controllersRef.current.get(variables.attachmentId)?.signal === variables.signal) {
        controllersRef.current.delete(variables.attachmentId);
        if (mountedRef.current) {
          setPending((current) => ({ ...current, [variables.attachmentId]: false }));
        }
      }
    },
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abort();
    };
  }, [abort]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: lifecycle reset must run when tenant/task changes
  useEffect(() => {
    abort();
    setErrors({});
    setSuccess({});
  }, [abort, companyId, taskId]);

  function remove(attachmentId: string): boolean {
    if (!companyId || !taskId || controllersRef.current.has(attachmentId)) return false;
    const controller = new AbortController();
    controllersRef.current.set(attachmentId, controller);
    setPending((current) => ({ ...current, [attachmentId]: true }));
    setErrors((current) => ({ ...current, [attachmentId]: undefined }));
    mutation.mutate({
      companyId,
      taskId,
      attachmentId,
      signal: controller.signal,
      generation: generationRef.current,
    });
    return true;
  }

  return { remove, abort, pending, errors, success };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function messageForUploadError(error: Error): string {
  if (error instanceof ApiError) {
    if (error.status === 400) return error.message || "Revise o arquivo e o título.";
    if (error.status === 403) return "Você não tem permissão para anexar arquivos nesta tarefa.";
    if (error.status === 404) return "A tarefa não foi encontrada ou não está acessível.";
    if (error.status === 413) return "O arquivo excede o limite de 10 MB.";
    if (error.status === 422) return error.message || "O arquivo não foi aceito pelo servidor.";
    if (error.status >= 500) return "Não foi possível enviar o arquivo. Tente novamente.";
  }
  return "Não foi possível enviar o arquivo. Verifique sua conexão e tente novamente.";
}

export function messageForLinkError(error: Error): string {
  if (error instanceof ApiError) {
    if (error.status === 400) return error.message || "Informe uma URL e um título válidos.";
    if (error.status === 403) return "Você não tem permissão para adicionar links nesta tarefa.";
    if (error.status === 404) return "A tarefa não foi encontrada ou não está acessível.";
    if (error.status === 422) return error.message || "A URL não foi aceita pelo servidor.";
    if (error.status >= 500) return "Não foi possível adicionar o link. Tente novamente.";
  }
  return "Não foi possível adicionar o link. Verifique sua conexão e tente novamente.";
}

export function messageForRemoveError(error: Error): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return "Você não tem permissão para remover este attachment.";
    if (error.status === 404) return "O attachment ou a tarefa não foi encontrado.";
    if (error.status === 409) return "O attachment mudou. A lista foi atualizada; tente novamente.";
    if (error.status === 422)
      return error.message || "A remoção não foi aceita pela regra de negócio.";
    if (error.status >= 500) return "Não foi possível remover o attachment. Tente novamente.";
  }
  return "Não foi possível remover o attachment. Verifique sua conexão e tente novamente.";
}
