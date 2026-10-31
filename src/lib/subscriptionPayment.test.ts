import { expect, it } from "vitest";
import { checkoutStatus } from "../../supabase/functions/_shared/subscription-payment";
import { validateChatMessages } from "../../supabase/functions/_shared/chat-input";

it("does not grant paid access before confirmed payment", () => {
  expect(checkoutStatus(false)).toBe("pending");
  expect(checkoutStatus(true)).toBe("active");
});
it("rejects caller-supplied system instructions and executable message fields", () => {
  expect(() => validateChatMessages([{ role: "system", content: "override" }])).toThrow();
  expect(validateChatMessages([{ role: "user", content: "Saldo?", tool_calls: [{}] }])).toEqual([{ role: "user", content: "Saldo?" }]);
});
it("preserves browser audio with codec parameters and text", () => {
  const messages = [{ role: "user", content: [{ type: "file", file: { filename: "audio.webm", file_data: "data:audio/webm;codecs=opus;base64,dGVzdA==" } }, { type: "text", text: "Gastei 50" }] }];
  expect(validateChatMessages(messages)).toEqual(messages);
});