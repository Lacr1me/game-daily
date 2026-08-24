export const MESSAGE_CONFIG = Object.freeze({
  apiBaseUrl: "",
  turnstileSiteKey: ""
});

export function messageServiceConfigured(config = MESSAGE_CONFIG) {
  return /^https:\/\/[^/]+\/functions\/v1$/u.test(config.apiBaseUrl) && Boolean(config.turnstileSiteKey);
}
