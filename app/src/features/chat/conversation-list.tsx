import { useEffect, useState } from "react";
import { IdLookupField } from "@/components/common/id-lookup-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createChatParticipantLookup } from "@/features/lookups/lookup-adapters";
import type { ConversationOutput } from "./chat-contracts";
import { useCreateConversation } from "./chat-mutations";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface ConversationListProps {
  companyId: string;
  currentUserId: string;
  conversations: ConversationOutput[];
  selectedId: string | null;
  onSelect: (conversationId: string) => void;
  enableParticipantLookup?: boolean;
}

export function ConversationList({
  companyId,
  currentUserId,
  conversations,
  selectedId,
  onSelect,
  enableParticipantLookup = false,
}: ConversationListProps) {
  const [participantId, setParticipantId] = useState("");
  const [participantName, setParticipantName] = useState<string | null>(null);
  const [validation, setValidation] = useState<string | null>(null);
  const createConversation = useCreateConversation(companyId);

  useEffect(() => {
    if (!createConversation.isSuccess) return;
    setParticipantId("");
    setParticipantName(null);
    onSelect(createConversation.data.id);
    createConversation.reset();
  }, [createConversation.data, createConversation.isSuccess, createConversation.reset, onSelect]);

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    const value = participantId.trim();
    if (!UUID_PATTERN.test(value)) {
      setValidation("Informe um UUID válido.");
      return;
    }
    setValidation(null);
    createConversation.reset();
    createConversation.create(value);
  }

  return (
    <aside className="chat-sidebar" aria-labelledby="chat-conversations-title">
      <div className="chat-sidebar-heading">
        <h2 id="chat-conversations-title">Conversas</h2>
        <span>{conversations.length}</span>
      </div>
      <form className="chat-create-form" onSubmit={submit} noValidate>
        {enableParticipantLookup ? (
          <IdLookupField
            label="Participante"
            value={participantId}
            displayValue={participantName}
            placeholder="Informe ou selecione um ID"
            lookup={createChatParticipantLookup(companyId)}
            disabled={createConversation.isPending}
            onChange={(item) => {
              setParticipantId(item?.id ?? "");
              setParticipantName(item?.label ?? null);
              setValidation(null);
            }}
          />
        ) : (
          <label htmlFor="chat-participant-id">Iniciar conversa por ID do participante</label>
        )}
        {!enableParticipantLookup && (
          <div className="chat-create-row">
            <Input
              id="chat-participant-id"
              value={participantId}
              placeholder="00000000-0000-0000-0000-000000000000"
              autoComplete="off"
              disabled={createConversation.isPending}
              aria-describedby="chat-participant-help chat-create-feedback"
              aria-invalid={Boolean(validation || createConversation.isError)}
              onChange={(event) => {
                setParticipantId(event.target.value);
                setValidation(null);
              }}
            />
          </div>
        )}
        <div className="chat-create-row">
          <Button className="chat-target" type="submit" disabled={createConversation.isPending}>
            {createConversation.isPending ? "Criando..." : "Criar"}
          </Button>
        </div>
        <p id="chat-participant-help">Use o UUID informado pelo participante.</p>
        <p id="chat-create-feedback" className="chat-form-feedback" role="alert">
          {validation ??
            (createConversation.isError
              ? "Não foi possível criar a conversa. Verifique seu acesso e tente novamente."
              : "")}
        </p>
      </form>
      {conversations.length === 0 ? (
        <p className="chat-list-empty">
          Nenhuma conversa. Inicie uma usando o UUID do participante.
        </p>
      ) : (
        <ul className="chat-conversation-list">
          {conversations.map((conversation) => {
            const name = conversationName(conversation, currentUserId);
            return (
              <li key={conversation.id}>
                <button
                  type="button"
                  className="chat-conversation-button"
                  data-selected={selectedId === conversation.id}
                  aria-current={selectedId === conversation.id ? "true" : undefined}
                  onClick={() => onSelect(conversation.id)}
                >
                  <span className="chat-conversation-topline">
                    <strong>{name}</strong>
                    {conversation.unreadCount > 0 && (
                      <span className="chat-unread">
                        <span aria-hidden="true">
                          {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
                        </span>
                        <span className="sr-only">
                          {conversation.unreadCount} mensagens não lidas
                        </span>
                      </span>
                    )}
                  </span>
                  <span className="chat-conversation-preview">
                    {conversation.lastMessage?.body ?? "Conversa sem mensagens"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

export function conversationName(conversation: ConversationOutput, currentUserId: string): string {
  const others = conversation.participants.filter(
    (participant) => participant.userId !== currentUserId,
  );
  const visible = others.length > 0 ? others : conversation.participants;
  return visible.map((participant) => participant.name).join(", ");
}
