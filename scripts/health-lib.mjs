const TLS_CERTIFICATE_CODES = new Set([
  "CERT_HAS_EXPIRED",
  "CERT_NOT_YET_VALID",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE"
]);

export function tlsCertificateCode(error) {
  for (let current = error; current; current = current.cause) {
    if (TLS_CERTIFICATE_CODES.has(current.code)) return current.code;
  }
  return null;
}

export function httpFallbackBase(base) {
  const url = new URL(base);
  if (url.protocol !== "https:") return null;
  url.protocol = "http:";
  return url.toString().replace(/\/$/, "");
}
