import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/http/api-error";

export function shouldRetryQuery(failureCount: number, error: Error): boolean {
  if (error instanceof ApiError) return error.status >= 500 && failureCount < 2;
  return failureCount < 2;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: shouldRetryQuery,
      },
    },
  });
}

export const queryClient = createQueryClient();
