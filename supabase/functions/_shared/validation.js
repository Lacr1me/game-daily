export const MESSAGE_LIMITS = Object.freeze({ nickname: 20, content: 300 });

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
