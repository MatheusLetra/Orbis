import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { type CreateTimeEntryInput, timeEntriesClient } from "./time-entry-client";
import type { TimeEntryOutput } from "./time-entry-contracts";
import { timeEntryKeys } from "./time-entry-keys";

interface RegisterVariables {
  companyId: string;
  taskId: string;
  input: CreateTimeEntryInput;
  signal: AbortSignal;
  generation: number;
}

export interface UseRegisterTimeEntryOptions {
  onSuccess?: (output: TimeEntryOutput) => void;
  onError?: (error: Error) => void;
}

export function useRegisterTimeEntry(
  companyId: string | null,
  taskId: string | null,
  options: UseRegisterTimeEntryOptions = {},
) {
  const queryClient = useQueryClient();
  const controllerRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  const mountedRef = useRef(true);
  const [error, setError] = useState<Error | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const abort = useCallback((): void => {
    generationRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  const mutation = useMutation<TimeEntryOutput, Error, RegisterVariables>({
    mutationKey: ["time-entries", "register"],
    mutationFn: ({ companyId: id, taskId: currentTaskId, input, signal }) =>
      timeEntriesClient.createForTask(id, currentTaskId, input, { signal }),
    onSuccess: async (output, variables) => {
      if (
        !mountedRef.current ||
        variables.generation !== generationRef.current ||
        variables.signal.aborted
      )
        return;

      await queryClient.invalidateQueries({
        queryKey: timeEntryKeys.taskPrefix(variables.companyId, variables.taskId),
      });

      if (
        mountedRef.current &&
        variables.generation === generationRef.current &&
        !variables.signal.aborted
      ) {
        setIsSuccess(true);
        options.onSuccess?.(output);
      }
    },
    onError: (cause, variables) => {
      if (
        isAbortError(cause) ||
        variables.signal.aborted ||
        variables.generation !== generationRef.current
      )
        return;
      setError(cause);
      options.onError?.(cause);
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
    setIsSuccess(false);
  }, [abort, companyId, taskId]);

  function register(input: CreateTimeEntryInput): boolean {
    if (!companyId || !taskId || mutation.isPending || controllerRef.current !== null) return false;
    const controller = new AbortController();
    controllerRef.current = controller;
    setError(null);
    setIsSuccess(false);
    mutation.mutate({
      companyId,
      taskId,
      input,
      signal: controller.signal,
      generation: generationRef.current,
    });
    return true;
  }

  return {
    register,
    abort,
    isPending: mutation.isPending,
    isSuccess,
    error,
    clearError: () => setError(null),
    reset: () => mutation.reset(),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
