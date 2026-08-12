import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "@/features/auth/auth-provider";

export function QueryCacheLifecycle() {
  const auth = useAuth();
  const client = useQueryClient();

  useEffect(() => {
    if (auth.status === "unauthenticated") client.clear();
  }, [auth.status, client]);

  return null;
}
