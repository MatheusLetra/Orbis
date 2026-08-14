import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSendMessage } from "./chat-mutations";

export function MessageComposer({
  companyId,
  conversationId,
}: {
  companyId: string;
  conversationId: string;
}) {
  const [body, setBody] = useState("");
  const [validation, setValidation] = useState<string | null>(null);
  const sendMessage = useSendMessage(companyId, conversationId);

  useEffect(() => {
    if (!sendMessage.isSuccess) return;
    setBody("");
    setValidation(null);
    sendMessage.reset();
  }, [sendMessage.isSuccess, sendMessage.reset]);

  function submit(): void {
    const canonicalBody = body.trim();
    if (canonicalBody.length < 1 || canonicalBody.length > 5000) {
      setValidation("A mensagem deve ter entre 1 e 5000 caracteres após remover espaços.");
      return;
    }
    setValidation(null);
    sendMessage.reset();
    sendMessage.send(canonicalBody);
  }

  return (
    <form
      className="chat-composer"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label htmlFor="chat-message-body">Mensagem</label>
      <div className="chat-composer-row">
        <Textarea
          id="chat-message-body"
          value={body}
          rows={2}
          disabled={sendMessage.isPending}
          aria-describedby="chat-message-help chat-message-feedback"
          aria-invalid={Boolean(validation || sendMessage.isError)}
          onChange={(event) => {
            setBody(event.target.value);
            setValidation(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (!sendMessage.isPending) submit();
            }
          }}
        />
        <Button className="chat-target" type="submit" disabled={sendMessage.isPending}>
          {sendMessage.isPending ? "Enviando..." : "Enviar"}
        </Button>
      </div>
      <div className="chat-composer-meta">
        <p id="chat-message-help">Enter envia. Shift+Enter cria uma nova linha.</p>
        <span>{body.length}/5000</span>
      </div>
      <p id="chat-message-feedback" className="chat-form-feedback" role="alert">
        {validation ??
          (sendMessage.isError
            ? "Não foi possível enviar. Sua mensagem foi preservada; tente novamente."
            : "")}
      </p>
    </form>
  );
}
