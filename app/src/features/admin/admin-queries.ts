import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminClient } from "./admin-client";
import { adminKeys } from "./admin-keys";

const disabled = "disabled";
export const useAdminCompanies = (companyId: string | null) =>
  useQuery({
    queryKey: adminKeys.companies(companyId ?? disabled),
    queryFn: ({ signal }) => adminClient.companies({ signal }),
    enabled: Boolean(companyId),
  });
export const useCapacitySettings = (companyId: string | null) =>
  useQuery({
    queryKey: adminKeys.capacity(companyId ?? disabled),
    queryFn: ({ signal }) => adminClient.capacity(companyId as string, { signal }),
    enabled: Boolean(companyId),
  });
export const useAdminMembers = (companyId: string | null) =>
  useQuery({
    queryKey: adminKeys.members(companyId ?? disabled),
    queryFn: ({ signal }) => adminClient.members(companyId as string, { signal }),
    enabled: Boolean(companyId),
  });
export const useAdminRequisitions = (companyId: string | null, filters: string) =>
  useQuery({
    queryKey: adminKeys.requisitions(companyId ?? disabled, filters),
    queryFn: ({ signal }) => adminClient.requisitions(companyId as string, filters, { signal }),
    enabled: Boolean(companyId),
  });
export const useAdminRequisition = (companyId: string | null, id: string | null) =>
  useQuery({
    queryKey: adminKeys.requisition(companyId ?? disabled, id ?? disabled),
    queryFn: ({ signal }) => adminClient.requisition(companyId as string, id as string, { signal }),
    enabled: Boolean(companyId && id),
  });
export const useAdminSystems = (companyId: string | null) =>
  useQuery({
    queryKey: adminKeys.systems(companyId ?? disabled),
    queryFn: ({ signal }) => adminClient.systems(companyId as string, { signal }),
    enabled: Boolean(companyId),
  });
export const useAdminVersions = (companyId: string | null, systemId: string | null) =>
  useQuery({
    queryKey: adminKeys.versions(companyId ?? disabled, systemId ?? disabled),
    queryFn: ({ signal }) =>
      adminClient.versions(companyId as string, systemId as string, { signal }),
    enabled: Boolean(companyId && systemId),
  });
export const useAdminReleases = (companyId: string | null) =>
  useQuery({
    queryKey: adminKeys.releases(companyId ?? disabled),
    queryFn: ({ signal }) => adminClient.releases(companyId as string, { signal }),
    enabled: Boolean(companyId),
  });

export function useAdminAudit(companyId: string | null, filters: string) {
  return useInfiniteQuery({
    queryKey: adminKeys.audit(companyId ?? disabled, filters),
    queryFn: ({ pageParam, signal }) =>
      adminClient.audit(
        companyId as string,
        [filters, pageParam ? `cursor=${encodeURIComponent(pageParam)}` : ""]
          .filter(Boolean)
          .join("&"),
        { signal },
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: Boolean(companyId),
  });
}

export function useAdminAction(companyId: string | null) {
  const cache = useQueryClient();
  return useMutation({
    mutationKey: ["admin", "action", companyId],
    mutationFn: (action: () => Promise<unknown>) => action(),
    onSuccess: async () => {
      if (!companyId) return;
      await Promise.all([
        cache.invalidateQueries({ queryKey: adminKeys.tenant(companyId) }),
        cache.invalidateQueries({ queryKey: ["companies"] }),
      ]);
    },
  });
}
