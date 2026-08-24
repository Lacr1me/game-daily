export const MESSAGE_CONFIG = Object.freeze({
  apiBaseUrl: "https://etkjbxfdwmhqmuyzpttq.supabase.co/functions/v1",
  turnstileSiteKey: "0x4AAAAAAEaAYxUF2T8CqG3K"
});

export function messageServiceConfigured(config = MESSAGE_CONFIG) {
  return /^https:\/\/[^/]+\/functions\/v1$/u.test(config.apiBaseUrl) && Boolean(config.turnstileSiteKey);
}
