import { DEFAULT_VOLUME, MESSAGE } from "./shared/constants.js";
import { clampVolume } from "./shared/settings.js";
import { callChrome, sendMessage } from "./shared/chrome-async.js";

const OFFSCREEN_URL = "src/offscreen/offscreen.html";
let creatingOffscreen = null;
const captureLocks = new Map();

async function hasOffscreenDocument() {
  if (!chrome.runtime.getContexts) return false;
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_URL)],
  });
  return contexts.length > 0;
}

async function ensureOffscreenDocument() {
  if (await hasOffscreenDocument()) return;
  if (!creatingOffscreen) {
    creatingOffscreen = chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: ["USER_MEDIA"],
      justification: "Route captured tab audio through Web Audio gain controls.",
    }).finally(() => {
      creatingOffscreen = null;
    });
  }
  await creatingOffscreen;
}

async function offscreen(message) {
  await ensureOffscreenDocument();
  const response = await sendMessage({ ...message, target: "offscreen" });
  if (!response?.ok) throw new Error(response?.error || "The audio engine did not respond.");
  return response;
}

async function getState() {
  if (!(await hasOffscreenDocument())) {
    return { masterVolume: DEFAULT_VOLUME, tabs: {} };
  }
  const response = await sendMessage({ type: MESSAGE.OFFSCREEN_GET_STATE, target: "offscreen" });
  return response?.state || { masterVolume: DEFAULT_VOLUME, tabs: {} };
}

async function captureTab(tabId, volume, muted = false) {
  const state = await getState();
  if (state.tabs[String(tabId)]) {
    return offscreen({
      type: MESSAGE.OFFSCREEN_SET_TAB,
      tabId,
      volume: clampVolume(volume),
      muted: Boolean(muted),
    });
  }

  if (captureLocks.has(tabId)) return captureLocks.get(tabId);
  const operation = (async () => {
    await ensureOffscreenDocument();
    const streamId = await callChrome(
      chrome.tabCapture.getMediaStreamId.bind(chrome.tabCapture),
      { targetTabId: tabId },
    );
    return offscreen({
      type: MESSAGE.OFFSCREEN_START_TAB,
      tabId,
      streamId,
      volume: clampVolume(volume),
      muted: Boolean(muted),
    });
  })().finally(() => captureLocks.delete(tabId));
  captureLocks.set(tabId, operation);
  return operation;
}

async function handleMessage(message) {
  switch (message.type) {
    case MESSAGE.GET_AUDIO_STATE:
      return { ok: true, state: await getState() };
    case MESSAGE.SET_TAB_VOLUME:
      return captureTab(message.tabId, message.volume, message.muted);
    case MESSAGE.SET_TAB_MUTED: {
      const state = await getState();
      const current = state.tabs[String(message.tabId)];
      return captureTab(message.tabId, current?.volume ?? message.volume, message.muted);
    }
    case MESSAGE.RESET_TAB:
      return captureTab(message.tabId, DEFAULT_VOLUME, false);
    case MESSAGE.RELEASE_TAB:
      return offscreen({ type: MESSAGE.OFFSCREEN_STOP_TAB, tabId: message.tabId });
    case MESSAGE.SET_MASTER_VOLUME:
      return offscreen({ type: MESSAGE.OFFSCREEN_SET_MASTER, volume: clampVolume(message.volume) });
    case MESSAGE.RESET_ALL:
      return offscreen({ type: MESSAGE.OFFSCREEN_RESET_ALL });
    case MESSAGE.RELEASE_ALL:
      if (!(await hasOffscreenDocument())) return { ok: true };
      return offscreen({ type: MESSAGE.OFFSCREEN_STOP_ALL });
    default:
      return { ok: false, error: "Unknown message." };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.target === "offscreen" || message.type === MESSAGE.AUDIO_STATE_CHANGED) {
    return false;
  }
  handleMessage(message)
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (chrome.runtime.getContexts) {
    hasOffscreenDocument().then((exists) => {
      if (exists) sendMessage({ type: MESSAGE.OFFSCREEN_STOP_TAB, target: "offscreen", tabId }).catch(() => {});
    });
  }
});
