import { DEFAULT_SETTINGS, DEFAULT_VOLUME, MAX_VOLUME } from "./constants.js";

export function clampVolume(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_VOLUME;
  return Math.min(MAX_VOLUME, Math.max(0, Math.round(numeric)));
}

export function normalizeSettings(value) {
  const source = value && typeof value === "object" ? value : {};
  const rawSites = source.siteVolumes && typeof source.siteVolumes === "object"
    ? source.siteVolumes
    : {};
  const siteVolumes = {};

  for (const [site, volume] of Object.entries(rawSites)) {
    if (typeof site === "string" && site.length <= 253) {
      siteVolumes[site] = clampVolume(volume);
    }
  }

  return {
    ...DEFAULT_SETTINGS,
    masterVolume: clampVolume(source.masterVolume),
    siteVolumes,
  };
}

export function siteKeyFromUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isRestrictedUrl(rawUrl) {
  if (!rawUrl) return true;
  try {
    const url = new URL(rawUrl);
    const isWebStore = url.hostname === "chromewebstore.google.com"
      || (url.hostname === "chrome.google.com" && url.pathname.startsWith("/webstore"));
    return isWebStore || !["http:", "https:", "file:"].includes(url.protocol);
  } catch {
    return true;
  }
}

export function volumeForSite(settings, rawUrl) {
  const site = siteKeyFromUrl(rawUrl);
  if (!site) return DEFAULT_VOLUME;
  return clampVolume(settings.siteVolumes?.[site] ?? DEFAULT_VOLUME);
}

export function withSiteVolume(settings, rawUrl, volume) {
  const normalized = normalizeSettings(settings);
  const site = siteKeyFromUrl(rawUrl);
  if (!site) return normalized;
  return {
    ...normalized,
    siteVolumes: {
      ...normalized.siteVolumes,
      [site]: clampVolume(volume),
    },
  };
}
