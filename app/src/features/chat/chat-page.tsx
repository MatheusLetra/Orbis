import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/app/layouts/app-shell";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { useAuth } from "@/features/auth/auth-provider";
import { useActiveCompany } from "@/features/companies/active-company-provider";
import { useMarkConversationRead } from "./chat-mutations";
import { orderedUniqueMessages, useConversations, useMessages } from "./chat-queries";
import { ConversationList, conversationName } from "./conversation-list";
import { MessageComposer } from "./message-composer";
import { MessageList } from "./message-list";
import "./chat.css";

export function ChatPage() {
  const company = useActiveCompany();
  const auth = useAuth();
  const companyId = company.activeCompany?.id ?? null;
  const currentUserId = auth.user?.id ?? "";
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const conversations = useConversations(companyId);
  const messages = useMessages(companyId, selectedId);
  const markRead = useMarkConversationRead(companyId);
  const markedConversation = useRef<string | null>(null);
  const selected = conversations.data?.items.find((item) => item.id === selectedId) ?? null;
  const orderedMessages = orderedUniqueMessages(messages.data?.pages);

  useEffect(() => {
    if (!selectedId || !messages.isSuccess || markedConversation.current === selectedId) return;
    markedConversation.current = selectedId;
    markRead.markRead(selectedId);
  }, [markRead, messages.isSuccess, selectedId]);

  if (company.status !== "ready" || !company.activeCompany) {
    return (
      <AppShell>
        <section className="chat-company-state">
          <h1 className="sr-only">Chat</h1>
          {company.status === "error" ? (
            <ErrorState message="Não foi possível carregar suas empresas." />
          ) : company.status === "ready" && company.companies.length === 0 ? (
            <EmptyState
              title="Nenhuma empresa disponível"
              description="Sua conta não possui uma empresa autorizada."
            />
          ) : (
            <LoadingState label="Carregando empresa ativa..." />
          )}
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="chat-page" aria-labelledby="chat-page-title">
        <header className="chat-page-heading">
          <div>
            <p>Comunicação · {company.activeCompany.name}</p>
            <h1 id="chat-page-title">Chat</h1>
          </div>
        </header>
        <p className="sr-only" role="status" aria-live="polite">
          {conversations.isPending
            ? "Carregando conversas"
            : conversations.isError
              ? "Erro ao carregar conversas"
              : "Conversas carregadas"}
        </p>
        {conversations.isPending ? (
          <LoadingState label="Carregando conversas..." />
        ) : conversations.isError ? (
          <ErrorState
            message="Não foi possível carregar as conversas. Verifique seu acesso."
            onRetry={() => void conversations.refetch()}
          />
        ) : (
          <div className="chat-layout">
            <ConversationList
              companyId={company.activeCompany.id}
              currentUserId={currentUserId}
              conversations={conversations.data.items}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
            <section className="chat-thread" aria-labelledby="chat-thread-title">
              {!selectedId ? (
                <div className="chat-thread-placeholder">
                  <h2 id="chat-thread-title">Selecione uma conversa</h2>
                  <p>Escolha uma conversa para ler e enviar mensagens.</p>
                </div>
              ) : (
                <>
                  <header className="chat-thread-heading">
                    <h2 id="chat-thread-title">
                      {selected ? conversationName(selected, currentUserId) : "Conversa"}
                    </h2>
                  </header>
                  <p className="sr-only" role="status" aria-live="polite">
                    {messages.isPending
                      ? "Carregando mensagens"
                      : messages.isError
                        ? "Erro ao carregar mensagens"
                        : "Mensagens carregadas"}
                  </p>
                  {messages.isPending ? (
                    <LoadingState label="Carregando mensagens..." />
                  ) : messages.isError ? (
                    <div className="chat-thread-state">
                      <ErrorState
                        message="Não foi possível carregar as mensagens. Verifique seu acesso."
                        onRetry={() => void messages.refetch()}
                      />
                    </div>
                  ) : (
                    <MessageList
                      messages={orderedMessages}
                      currentUserId={currentUserId}
                      hasMore={messages.hasNextPage}
                      loadingPrevious={messages.isFetchingNextPage}
                      onLoadPrevious={() => void messages.fetchNextPage()}
                    />
                  )}
                  <MessageComposer
                    key={selectedId}
                    companyId={company.activeCompany.id}
                    conversationId={selectedId}
                  />
                </>
              )}
            </section>
          </div>
        )}
      </section>
    </AppShell>
  );
}
