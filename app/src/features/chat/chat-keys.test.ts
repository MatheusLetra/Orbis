import { describe, expect, it } from "vitest";
import { chatKeys } from "./chat-keys";

describe("chatKeys", () => {
  it("isola tenant, conversa, limite e cursor", () => {
    expect(chatKeys.messages("company-a", "conversation-a", 50)).not.toEqual(
      chatKeys.messages("company-b", "conversation-a", 50),
    );
    expect(chatKeys.messagePage("company-a", "conversation-a", "cursor-a")).not.toEqual(
      chatKeys.messagePage("company-a", "conversation-a", "cursor-b"),
    );
    expect(chatKeys.messagePage("company-a", "conversation-a", null)).toContain("page");
  });
});
