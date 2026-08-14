import { useLayoutEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import type { MessageOutput } from "./chat-contracts";

interface MessageListProps {
  messages: MessageOutput[];
  currentUserId: string;
  hasMore: boolean;
  loadingPrevious: boolean;
  onLoadPrevious: () => void;
}

export function MessageList({
  messages,
  currentUserId,
  hasMore,
  loadingPrevious,
  onLoadPrevious,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const previousHeight = useRef<number | null>(null);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element || previousHeight.current === null) return;
    element.scrollTop += element.scrollHeight - previousHeight.current;
    previousHeight.current = null;
  });

  function loadPrevious(): void {
    if (loadingPrevious) return;
    previousHeight.current = scrollRef.current?.scrollHeight ?? null;
    onLoadPrevious();
  }

  return (
    <section className="chat-message-scroll" ref={scrollRef} aria-label="Mensagens">
      {hasMore && (
        <div className="chat-load-previous">
          <Button
            type="button"
            variant="outline"
            className="chat-target"
            disabled={loadingPrevious}
            onClick={loadPrevious}
          >
            {loadingPrevious ? "Carregando..." : "Carregar mensagens anteriores"}
          </Button>
        </div>
      )}
      {messages.length === 0 ? (
        <p className="chat-message-empty">Nenhuma mensagem ainda. Escreva a primeira.</p>
      ) : (
        <ol className="chat-message-list">
          {messages.map((message) => (
            <li
              key={message.id}
              className="chat-message"
              data-own={message.senderId === currentUserId}
            >
              <p>{message.body}</p>
              <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function formatMessageTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
