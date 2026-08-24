export const MESSAGE_LIMITS = Object.freeze({ nickname: 20, content: 300, reply: 500 });

export function codePointLength(value) {
  return Array.from(value).length;
}

export function normalizeNickname(value) {
  return String(value ?? "").normalize("NFKC").trim().replace(/\s+/gu, " ");
}

export function normalizeContent(value) {
  return String(value ?? "").normalize("NFKC").replace(/\r\n?/gu, "\n").trim();
}

export function validateMessageInput(input) {
  const nickname = normalizeNickname(input?.nickname);
  const content = normalizeContent(input?.content);
  const nicknameLength = codePointLength(nickname);
  const contentLength = codePointLength(content);
  if (nicknameLength < 1 || nicknameLength > MESSAGE_LIMITS.nickname) {
    return { ok: false, code: "INVALID_NICKNAME", message: "昵称需为 1—20 个字符。" };
  }
  if (contentLength < 1 || contentLength > MESSAGE_LIMITS.content) {
    return { ok: false, code: "INVALID_CONTENT", message: "留言需为 1—300 个字符。" };
  }
  if (/\u0000/u.test(content)) {
    return { ok: false, code: "INVALID_CONTENT", message: "留言包含不支持的字符。" };
  }
  return { ok: true, nickname, content };
}

export function validateReplyInput(value) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return { ok: true, reply: null };
  }
  const reply = normalizeContent(value);
  if (codePointLength(reply) < 1 || codePointLength(reply) > MESSAGE_LIMITS.reply || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(reply)) {
    return { ok: false, code: "INVALID_OWNER_REPLY", message: "回复需为 1—500 个字符，且不能包含控制字符。" };
  }
  return { ok: true, reply };
}
