import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/http/api-error";
import { createQueryClient } from "@/lib/query/query-client";
import { NotificationCenter } from "./notification-center";
import { notificationClient } from "./notification-client";
import type { NotificationPreferences, NotificationsPage } from "./notification-contracts";
import {
  notificationItem,
  notificationPreferences,
  notificationsPage,
  taskAssignedPreference,
} from "./notification-test-fixtures";

function renderCenter(companyId: string | null = "company-a") {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <NotificationCenter companyId={companyId} />
    </QueryClientProvider>,
  );
}

describe("NotificationCenter", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("só consulta por ação explícita e exibe conteúdo e preferências acessíveis", async () => {
    const user = userEvent.setup();
    const list = vi.spyOn(notificationClient, "list").mockResolvedValue(notificationsPage);
    const preferences = vi
      .spyOn(notificationClient, "preferences")
      .mockResolvedValue(notificationPreferences);
    renderCenter();
    const trigger = screen.getByRole("button", { name: "Notificações" });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(list).not.toHaveBeenCalled();
    expect(preferences).not.toHaveBeenCalled();

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog", { name: "Notificações" })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Fechar notificações" })).toHaveFocus(),
    );
    expect(await screen.findByText("Nova tarefa atribuída")).toBeInTheDocument();
    expect(screen.getByText(/descrição suficientemente longa/)).toBeInTheDocument();
    expect(screen.getByText("Não lida")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Tarefa atribuída" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Release publicada" })).not.toBeChecked();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(trigger).toHaveAccessibleName("Notificações, 1 não lida");
  });

  it("marca leitura e atualiza preferência somente após respostas canônicas", async () => {
    const user = userEvent.setup();
    const readPage: NotificationsPage = {
      ...notificationsPage,
      items: [{ ...notificationItem, readAt: "2026-08-14T13:00:00Z" }],
      unreadCount: 0,
    };
    const changedPreferences: NotificationPreferences = {
      items: notificationPreferences.items.map((item) =>
        item.eventType === "TASK_ASSIGNED" ? { ...item, inAppEnabled: false } : item,
      ),
    };
    vi.spyOn(notificationClient, "list")
      .mockResolvedValueOnce(notificationsPage)
      .mockResolvedValue(readPage);
    vi.spyOn(notificationClient, "preferences")
      .mockResolvedValueOnce(notificationPreferences)
      .mockResolvedValue(changedPreferences);
    const readItem = { ...notificationItem, readAt: "2026-08-14T13:00:00Z" };
    const markRead = vi.spyOn(notificationClient, "markRead").mockResolvedValue(readItem);
    const update = vi
      .spyOn(notificationClient, "updatePreference")
      .mockResolvedValue({ ...taskAssignedPreference, inAppEnabled: false });
    renderCenter();
    await user.click(screen.getByRole("button", { name: "Notificações" }));
    await user.click(await screen.findByRole("button", { name: "Marcar como lida" }));
    await waitFor(() => expect(markRead).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Marcar como lida" })).not.toBeInTheDocument(),
    );

    const checkbox = screen.getByRole("checkbox", { name: "Tarefa atribuída" });
    await user.click(checkbox);
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        "company-a",
        { eventType: "TASK_ASSIGNED", inAppEnabled: false },
        { signal: expect.any(AbortSignal) },
      ),
    );
    await waitFor(() => expect(checkbox).not.toBeChecked());
  });

  it("cobre loading, erro, retry e vazio", async () => {
    const user = userEvent.setup();
    let rejectList: (cause: unknown) => void = () => undefined;
    vi.spyOn(notificationClient, "list")
      .mockImplementationOnce(() => new Promise((_resolve, reject) => (rejectList = reject)))
      .mockResolvedValue({ items: [], unreadCount: 0, hasMore: false });
    vi.spyOn(notificationClient, "preferences").mockResolvedValue({ items: [] });
    renderCenter();
    await user.click(screen.getByRole("button", { name: "Notificações" }));
    expect(screen.getByText("Carregando notificações...")).toBeInTheDocument();
    rejectList(new ApiError({ status: 400, code: "BAD", message: "falha" }));
    expect(
      await screen.findByText("Não foi possível carregar as notificações."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByRole("region", { name: "Nenhuma notificação" })).toBeInTheDocument();
  });

  it("fecha com Escape, aborta requests e restaura foco no botão", async () => {
    const user = userEvent.setup();
    let listSignal: AbortSignal | null | undefined;
    vi.spyOn(notificationClient, "list").mockImplementation((_companyId, options) => {
      listSignal = options?.signal;
      return new Promise(() => undefined);
    });
    vi.spyOn(notificationClient, "preferences").mockImplementation(
      () => new Promise(() => undefined),
    );
    renderCenter();
    const trigger = screen.getByRole("button", { name: "Notificações" });
    await user.click(trigger);
    await waitFor(() => expect(listSignal).toBeDefined());
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(listSignal?.aborted).toBe(true);
  });

  it("desabilita o centro sem empresa", () => {
    renderCenter(null);
    expect(screen.getByRole("button", { name: "Notificações" })).toBeDisabled();
  });
});
