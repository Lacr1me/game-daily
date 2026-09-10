import { createHash } from 'node:crypto';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function requireEvidence(condition, code, message) {
  if (!condition) throw Object.assign(new Error(message), { code });
}
export function assertFreshEvidence(evidence, checkedAt, maxAgeMs = 15 * 60 * 1000) {
  const age = Date.parse(checkedAt) - Date.parse(evidence?.checkedAt);
  requireEvidence(Number.isFinite(age) && age >= -60000 && age <= maxAgeMs, 'EVIDENCE_STALE', 'Evidence timestamp missing, future or stale');
}
export function verifyDeploymentProof(proof, {targetCommit, checkedAt, base}) {
  requireEvidence(/^[a-f0-9]{40}$/i.test(targetCommit || ''), 'TARGET_COMMIT_MISSING', 'A full target commit is required');
  requireEvidence(proof?.source === 'github-pages-api', 'DEPLOYMENT_PROOF_MISSING', 'GitHub Pages API proof is missing');
  assertFreshEvidence(proof, checkedAt);
  requireEvidence(proof.headSha === targetCommit && proof.conclusion === 'success', 'DEPLOYMENT_COMMIT_MISMATCH', 'Pages build does not prove the target commit succeeded');
  const evidence = new URL(proof.evidenceUrl);
  requireEvidence(evidence.protocol === 'https:' && evidence.hostname === 'api.github.com' && /^\/repos\/[^/]+\/[^/]+\/pages\/builds\/\d+$/.test(evidence.pathname), 'DEPLOYMENT_SOURCE_INVALID', 'Expected a GitHub Pages build API URL');
  requireEvidence(new URL(proof.siteUrl).host === new URL(base).host, 'DEPLOYMENT_SITE_MISMATCH', 'Pages evidence is for another site');
  return {...proof, targetCommit};
}
export function verifyPageEvidence(proof, {date, channel, url, checkedAt}) {
  requireEvidence(proof?.method === 'browser', 'PAGE_BROWSER_PROOF_MISSING', 'Static HTML/JSON cannot establish the displayed date; browser observation is required');
  assertFreshEvidence(proof, checkedAt);
  const observed = new URL(proof.url), requested = new URL(url);
  requireEvidence(observed.origin === requested.origin && observed.pathname === requested.pathname && observed.searchParams.get('date') === date, 'PAGE_URL_MISMATCH', 'Browser evidence is for another edition URL');
  requireEvidence(proof.displayedDate === date && proof.selectedDate === date, 'PAGE_DATE_MISMATCH', 'Page did not display/select the target edition');
  const download = new URL(proof.downloadUrl, url);
  requireEvidence(download.origin === new URL(url).origin && download.pathname === `/downloads/${channel}/${date}.png`, 'PAGE_DOWNLOAD_MISMATCH', 'Page download is not the target PNG');
  return proof;
}

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
