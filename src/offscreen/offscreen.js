import { DEFAULT_VOLUME, MESSAGE } from "../shared/constants.js";
import { clampVolume } from "../shared/settings.js";

const audioContext = new AudioContext();
const masterGain = audioContext.createGain();
masterGain.connect(audioContext.destination);
const sessions = new Map();
let masterVolume = DEFAULT_VOLUME;

function gainValue(volume, muted = false) {
  return muted ? 0 : clampVolume(volume) / 100;
}

function snapshot() {
  const tabs = {};
  for (const [tabId, session] of sessions) {
    tabs[String(tabId)] = { volume: session.volume, muted: session.muted };
  }
  return { masterVolume, tabs };
}

function broadcast() {
  chrome.runtime.sendMessage({ type: MESSAGE.AUDIO_STATE_CHANGED, state: snapshot() }).catch(() => {});
}

function stopTab(tabId, shouldBroadcast = true) {
  const session = sessions.get(Number(tabId));
  if (!session) return;
  sessions.delete(Number(tabId));
  session.intentionalStop = true;
  for (const track of session.stream.getTracks()) track.stop();
  session.source.disconnect();
  session.gain.disconnect();
  if (shouldBroadcast) broadcast();
}

async function startTab({ tabId, streamId, volume, muted }) {
  const numericTabId = Number(tabId);
  if (sessions.has(numericTabId)) {
    setTab({ tabId: numericTabId, volume, muted });
    return;
  }
  await audioContext.resume();
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId,
      },
    },
    video: false,
  });
  const source = audioContext.createMediaStreamSource(stream);
  const gain = audioContext.createGain();
  const session = {
    stream,
    source,
    gain,
    volume: clampVolume(volume),
    muted: Boolean(muted),
    intentionalStop: false,
  };
  gain.gain.value = gainValue(session.volume, session.muted);
  source.connect(gain).connect(masterGain);
  sessions.set(numericTabId, session);
  for (const track of stream.getTracks()) {
    track.addEventListener("ended", () => {
      if (!session.intentionalStop) {
        sessions.delete(numericTabId);
        broadcast();
      }
    }, { once: true });
  }
  broadcast();
}

function setTab({ tabId, volume, muted }) {
  const session = sessions.get(Number(tabId));
  if (!session) throw new Error("This tab is not connected to the mixer.");
  if (volume !== undefined) session.volume = clampVolume(volume);
  if (muted !== undefined) session.muted = Boolean(muted);
  session.gain.gain.setTargetAtTime(gainValue(session.volume, session.muted), audioContext.currentTime, 0.015);
  broadcast();
}

function setMaster(volume) {
  masterVolume = clampVolume(volume);
  masterGain.gain.setTargetAtTime(masterVolume / 100, audioContext.currentTime, 0.015);
  broadcast();
}

function resetAll() {
  setMaster(DEFAULT_VOLUME);
  for (const [tabId] of sessions) setTab({ tabId, volume: DEFAULT_VOLUME, muted: false });
  broadcast();
}

async function handle(message) {
  switch (message.type) {
    case MESSAGE.OFFSCREEN_GET_STATE:
      return { ok: true, state: snapshot() };
    case MESSAGE.OFFSCREEN_START_TAB:
      await startTab(message);
      return { ok: true, state: snapshot() };
    case MESSAGE.OFFSCREEN_SET_TAB:
      setTab(message);
      return { ok: true, state: snapshot() };
    case MESSAGE.OFFSCREEN_STOP_TAB:
      stopTab(message.tabId);
      return { ok: true, state: snapshot() };
    case MESSAGE.OFFSCREEN_SET_MASTER:
      setMaster(message.volume);
      return { ok: true, state: snapshot() };
    case MESSAGE.OFFSCREEN_RESET_ALL:
      resetAll();
      return { ok: true, state: snapshot() };
    case MESSAGE.OFFSCREEN_STOP_ALL:
      for (const tabId of [...sessions.keys()]) stopTab(tabId, false);
      broadcast();
      return { ok: true, state: snapshot() };
    default:
      return { ok: false, error: "Unknown audio-engine message." };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== "offscreen") return false;
  handle(message)
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});
