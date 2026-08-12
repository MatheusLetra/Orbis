import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppProviders } from "@/app/providers/app-providers";
import { useAuth } from "@/features/auth/auth-provider";
import { LoginPage } from "@/features/auth/login-page";
import { CompanyPage } from "@/features/companies/company-page";
import { KanbanPage } from "@/features/kanban/kanban-page";

function AppRoutes() {
  const auth = useAuth();
  const location = useLocation();

  if (auth.status === "initializing") {
    return (
      <main className="grid min-h-dvh place-items-center" aria-busy="true">
        <p className="text-sm text-muted-foreground">Restaurando sessão...</p>
      </main>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={auth.status === "authenticated" ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/kanban"
        element={
          auth.status === "authenticated" ? (
            <KanbanPage />
          ) : (
            <Navigate to="/login" replace state={{ from: location }} />
          )
        }
      />
      <Route
        path="/*"
        element={
          auth.status === "authenticated" ? (
            <CompanyPage />
          ) : (
            <Navigate to="/login" replace state={{ from: location }} />
          )
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AppProviders>
      <AppRoutes />
    </AppProviders>
  );
}
