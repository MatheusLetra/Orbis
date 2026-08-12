import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/features/auth/auth-provider";
import { ActiveCompanyProvider } from "@/features/companies/active-company-provider";
import { ThemeProvider } from "@/hooks/use-theme";
import { QueryCacheLifecycle } from "@/lib/query/query-cache-lifecycle";
import { queryClient } from "@/lib/query/query-client";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <QueryCacheLifecycle />
            <ActiveCompanyProvider>{children}</ActiveCompanyProvider>
          </AuthProvider>
        </QueryClientProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
