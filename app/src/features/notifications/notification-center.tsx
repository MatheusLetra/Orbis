import { Bell, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import type { NotificationEventType } from "./notification-contracts";
import { useMarkNotificationRead, useUpdateNotificationPreference } from "./notification-mutations";
import { useNotificationPreferences, useNotifications } from "./notification-queries";
import "./notification-center.css";

const EVENT_LABELS: Record<NotificationEventType, string> = {
  TASK_ASSIGNED: "Tarefa atribuída",
  TASK_STATUS_CHANGED: "Status de tarefa alterado",
  REQUISITION_ASSIGNED: "Requisição atribuída",
  REQUISITION_COMPLETED: "Requisição concluída",
  RELEASE_PUBLISHED: "Release publicada",
};

export function NotificationCenter({ companyId }: { companyId: string | null }) {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const label = unreadCount
    ? `Notificações, ${unreadCount} ${unreadCount === 1 ? "não lida" : "não lidas"}`
    : "Notificações";

  function close(): void {
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        size="icon"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={!companyId}
        onClick={() => setOpen(true)}
      >
        <Bell aria-hidden="true" />
        {unreadCount !== null && unreadCount > 0 && (
          <span className="notification-center-badge" aria-hidden="true">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>
      {open && companyId && (
        <NotificationPanel companyId={companyId} onClose={close} onUnreadCount={setUnreadCount} />
      )}
    </>
  );
}

function NotificationPanel({
  companyId,
  onClose,
  onUnreadCount,
}: {
  companyId: string;
  onClose: () => void;
  onUnreadCount: (count: number) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const notifications = useNotifications(companyId, true);
  const preferences = useNotificationPreferences(companyId, true);
  const markRead = useMarkNotificationRead(companyId);
  const updatePreference = useUpdateNotificationPreference(companyId);

  useEffect(() => {
    if (notifications.data) onUnreadCount(notifications.data.unreadCount);
  }, [notifications.data, onUnreadCount]);

  return (
    <ResponsiveDialog
      open
      titleId="notification-center-title"
      initialFocusRef={closeRef}
      onClose={onClose}
    >
      <header className="responsive-dialog-header">
        <div>
          <h2 id="notification-center-title" className="notification-center-title">
            Notificações
          </h2>
          <p className="notification-center-subtitle">Atualizações desta empresa</p>
        </div>
        <Button
          ref={closeRef}
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Fechar notificações"
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </Button>
      </header>
      <div className="responsive-dialog-main notification-center-main">
        <section aria-labelledby="notification-list-title">
          <h3 id="notification-list-title" className="notification-center-section-title">
            Recentes
          </h3>
          {notifications.isPending && <LoadingState label="Carregando notificações..." />}
          {notifications.isError && (
            <ErrorState
              message="Não foi possível carregar as notificações."
              onRetry={() => void notifications.refetch()}
            />
          )}
          {notifications.data?.items.length === 0 && (
            <EmptyState
              title="Nenhuma notificação"
              description="As atualizações aparecerão aqui."
            />
          )}
          {notifications.data && notifications.data.items.length > 0 && (
            <ul className="notification-center-list">
              {notifications.data.items.map((item) => (
                <li
                  key={item.id}
                  className="notification-center-item"
                  data-unread={item.readAt === null}
                >
                  <div className="notification-center-item-heading">
                    <p className="notification-center-item-title">{item.title}</p>
                    {item.readAt === null && (
                      <span className="notification-center-unread">Não lida</span>
                    )}
                  </div>
                  {item.body && <p className="notification-center-body">{item.body}</p>}
                  <time className="notification-center-time" dateTime={item.createdAt}>
                    {new Intl.DateTimeFormat("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(new Date(item.createdAt))}
                  </time>
                  {item.readAt === null && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={markRead.isPending}
                      onClick={() => markRead.markRead(item.id)}
                    >
                      {markRead.isPending && markRead.variables?.notificationId === item.id
                        ? "Marcando..."
                        : "Marcar como lida"}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {notifications.data?.hasMore && (
            <p className="notification-center-more">Há mais notificações além das 20 exibidas.</p>
          )}
          {markRead.isError && (
            <p className="notification-center-error" role="alert">
              Não foi possível marcar a notificação como lida. Tente novamente.
            </p>
          )}
        </section>

        <section
          className="notification-center-preferences"
          aria-labelledby="notification-preferences-title"
        >
          <h3 id="notification-preferences-title" className="notification-center-section-title">
            Preferências
          </h3>
          <p className="notification-center-subtitle">
            Escolha quais eventos aparecem no aplicativo.
          </p>
          {preferences.isPending && <LoadingState label="Carregando preferências..." />}
          {preferences.isError && (
            <ErrorState
              message="Não foi possível carregar as preferências."
              onRetry={() => void preferences.refetch()}
            />
          )}
          {preferences.data && (
            <div className="notification-center-preference-list">
              {preferences.data.items.map((preference) => (
                <label className="notification-center-preference" key={preference.eventType}>
                  <span>{EVENT_LABELS[preference.eventType]}</span>
                  <input
                    type="checkbox"
                    checked={preference.inAppEnabled}
                    disabled={updatePreference.isPending}
                    onChange={(event) =>
                      updatePreference.update(preference.eventType, event.target.checked)
                    }
                  />
                </label>
              ))}
            </div>
          )}
          {updatePreference.isError && (
            <p className="notification-center-error" role="alert">
              Não foi possível atualizar a preferência. O estado anterior foi mantido.
            </p>
          )}
        </section>
      </div>
    </ResponsiveDialog>
  );
}
