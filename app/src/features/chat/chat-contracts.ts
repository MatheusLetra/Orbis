export interface ChatParticipant {
  userId: string;
  name: string;
}

export interface MessageOutput {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export interface ConversationOutput {
  id: string;
  companyId: string;
  type: "direct";
  participants: ChatParticipant[];
  lastMessage: MessageOutput | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationListOutput {
  items: ConversationOutput[];
}

export interface MessagePageOutput {
  items: MessageOutput[];
  hasMore: boolean;
  nextCursor: string | null;
}

export interface ReadOutput {
  conversationId: string;
  lastReadAt: string;
  unreadCount: 0;
}

export function parseMessage(value: unknown): MessageOutput {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["id", "conversationId", "senderId", "body", "createdAt"]) ||
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.conversationId) ||
    !isNonEmptyString(value.senderId) ||
    typeof value.body !== "string" ||
    !isIsoInstant(value.createdAt)
  ) {
    return invalid("mensagem");
  }
  return value as unknown as MessageOutput;
}

export function parseConversation(value: unknown): ConversationOutput {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "id",
      "companyId",
      "type",
      "participants",
      "lastMessage",
      "unreadCount",
      "createdAt",
      "updatedAt",
    ]) ||
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.companyId) ||
    value.type !== "direct" ||
    !Array.isArray(value.participants) ||
    value.participants.length === 0 ||
    !(value.lastMessage === null || isRecord(value.lastMessage)) ||
    !Number.isSafeInteger(value.unreadCount) ||
    (value.unreadCount as number) < 0 ||
    !isIsoInstant(value.createdAt) ||
    !isIsoInstant(value.updatedAt)
  ) {
    return invalid("conversa");
  }
  const participants = value.participants.map(parseParticipant);
  const lastMessage = value.lastMessage === null ? null : parseMessage(value.lastMessage);
  if (lastMessage && lastMessage.conversationId !== value.id) return invalid("conversa");
  return { ...(value as unknown as ConversationOutput), participants, lastMessage };
}

export function parseConversationList(value: unknown): ConversationListOutput {
  if (!isRecord(value) || !hasExactKeys(value, ["items"]) || !Array.isArray(value.items)) {
    return invalid("lista de conversas");
  }
  return { items: value.items.map(parseConversation) };
}

export function parseChatParticipantList(value: unknown): ChatParticipant[] {
  if (!Array.isArray(value)) throw new Error("Contrato de participantes do Chat inválido");
  return value.map(parseParticipant);
}

export function parseMessagePage(value: unknown): MessagePageOutput {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["items", "hasMore", "nextCursor"]) ||
    !Array.isArray(value.items) ||
    typeof value.hasMore !== "boolean" ||
    !(value.nextCursor === null || isNonEmptyString(value.nextCursor))
  ) {
    return invalid("página de mensagens");
  }
  const items = value.items.map(parseMessage);
  if (value.hasMore !== (value.nextCursor !== null)) return invalid("página de mensagens");
  for (let index = 1; index < items.length; index += 1) {
    const previous = items[index - 1];
    const current = items[index];
    if (previous && current && previous.createdAt > current.createdAt) {
      return invalid("ordenação das mensagens");
    }
  }
  return { items, hasMore: value.hasMore, nextCursor: value.nextCursor };
}

export function parseReadOutput(value: unknown): ReadOutput {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["conversationId", "lastReadAt", "unreadCount"]) ||
    !isNonEmptyString(value.conversationId) ||
    !isIsoInstant(value.lastReadAt) ||
    value.unreadCount !== 0
  ) {
    return invalid("leitura de conversa");
  }
  return value as unknown as ReadOutput;
}

function parseParticipant(value: unknown): ChatParticipant {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["userId", "name"]) ||
    !isNonEmptyString(value.userId) ||
    !isNonEmptyString(value.name)
  ) {
    return invalid("participante");
  }
  return value as unknown as ChatParticipant;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  const expected = new Set(keys);
  return actual.length === keys.length && actual.every((key) => expected.has(key));
}

function isIsoInstant(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function invalid(contract: string): never {
  throw new Error(`Contrato de ${contract} inválido`);
}
