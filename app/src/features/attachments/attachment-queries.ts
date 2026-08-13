import { useQuery } from "@tanstack/react-query";
import { attachmentsClient } from "./attachment-client";
import { attachmentKeys } from "./attachment-keys";

export function useTaskAttachments(
  companyId: string | null,
  taskId: string | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey:
      companyId && taskId
        ? attachmentKeys.task(companyId, taskId)
        : ["attachments", "task", "disabled"],
    queryFn: ({ signal }) =>
      attachmentsClient.listForTask(companyId as string, taskId as string, { signal }),
    enabled: Boolean(companyId && taskId && enabled),
  });
}
