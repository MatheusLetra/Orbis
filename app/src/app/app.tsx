import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppProviders } from "@/app/providers/app-providers";
import { useAuth } from "@/features/auth/auth-provider";
import { LoginPage } from "@/features/auth/login-page";
import { ChatPage } from "@/features/chat/chat-page";
import { CompanyPage } from "@/features/companies/company-page";
import { KanbanPage } from "@/features/kanban/kanban-page";
import { ReportsPage } from "@/features/reports/reports-page";
import { TimelinePage } from "@/features/timeline/timeline-page";
import { MonthlyTimelinePage } from "@/features/timeline-monthly/monthly-page";
import { YearlyTimelinePage } from "@/features/timeline-yearly/yearly-page";

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
        path="/chat"
        element={
          auth.status === "authenticated" ? (
            <ChatPage />
          ) : (
            <Navigate to="/login" replace state={{ from: location }} />
          )
        }
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
        path="/reports"
        element={
          auth.status === "authenticated" ? (
            <ReportsPage />
          ) : (
            <Navigate to="/login" replace state={{ from: location }} />
          )
        }
      />
      <Route
        path="/timeline/monthly"
        element={
          auth.status === "authenticated" ? (
            <MonthlyTimelinePage />
          ) : (
            <Navigate to="/login" replace state={{ from: location }} />
          )
        }
      />
      <Route
        path="/timeline/yearly"
        element={
          auth.status === "authenticated" ? (
            <YearlyTimelinePage />
          ) : (
            <Navigate to="/login" replace state={{ from: location }} />
          )
        }
      />
      <Route
        path="/timeline"
        element={
          auth.status === "authenticated" ? (
            <TimelinePage />
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
