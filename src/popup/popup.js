import { DEFAULT_SETTINGS, DEFAULT_VOLUME, MESSAGE, SETTINGS_KEY } from "../shared/constants.js";
import { clampVolume, isRestrictedUrl, normalizeSettings, siteKeyFromUrl, volumeForSite, withSiteVolume } from "../shared/settings.js";
import { callChrome, sendMessage } from "../shared/chrome-async.js";

const elements = {
  list: document.querySelector("#tab-list"),
  empty: document.querySelector("#empty-state"),
  count: document.querySelector("#tab-count"),
  notice: document.querySelector("#notice"),
  master: document.querySelector("#master-volume"),
  masterValue: document.querySelector("#master-value"),
  refresh: document.querySelector("#refresh"),
  resetAll: document.querySelector("#reset-all"),
  releaseAll: document.querySelector("#release-all"),
  template: document.querySelector("#tab-template"),
};

let settings = { ...DEFAULT_SETTINGS };
let audioState = { masterVolume: DEFAULT_VOLUME, tabs: {} };
let visibleTabs = [];

function setSlider(slider, value) {
  const volume = clampVolume(value);
  slider.value = String(volume);
  slider.style.setProperty("--value", `${volume / 2}%`);
}

function showNotice(message) {
  elements.notice.textContent = message;
  elements.notice.hidden = !message;
}

async function loadSettings() {
  const stored = await callChrome(chrome.storage.local.get.bind(chrome.storage.local), SETTINGS_KEY);
  settings = normalizeSettings(stored[SETTINGS_KEY]);
}

async function saveSettings(next) {
  settings = normalizeSettings(next);
  await callChrome(chrome.storage.local.set.bind(chrome.storage.local), { [SETTINGS_KEY]: settings });
}

async function loadAudioState() {
  const response = await sendMessage({ type: MESSAGE.GET_AUDIO_STATE });
  if (response?.ok) audioState = response.state;
}

function relevantTabs(tabs) {
  return tabs.filter((tab) => {
    const managed = Boolean(audioState.tabs[String(tab.id)]);
    return managed || tab.audible || tab.mutedInfo?.muted;
  }).sort((a, b) => Number(Boolean(audioState.tabs[String(b.id)])) - Number(Boolean(audioState.tabs[String(a.id)])));
}

function tabSite(tab) {
  return siteKeyFromUrl(tab.url) || (isRestrictedUrl(tab.url) ? "Browser page — unavailable" : "Local file");
}

function fallbackFavicon() {
  return "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><rect width="28" height="28" rx="7" fill="#292e3b"/><path d="M8 11v6h3l5 4V7l-5 4H8z" fill="#8f96aa"/></svg>');
}

async function applyTabAction(card, message, failureText) {
  card.dataset.busy = "true";
  showNotice("");
  try {
    const response = await sendMessage(message);
    if (!response?.ok) throw new Error(response?.error || failureText);
    audioState = response.state || audioState;
  } catch (error) {
    showNotice(`${failureText} ${error.message}`);
  } finally {
    card.dataset.busy = "false";
    renderTabs();
  }
}

function buildTabCard(tab) {
  const card = elements.template.content.firstElementChild.cloneNode(true);
  const session = audioState.tabs[String(tab.id)];
  const managed = Boolean(session);
  const restricted = isRestrictedUrl(tab.url);
  const volume = session?.volume ?? volumeForSite(settings, tab.url);
  const muted = session?.muted ?? false;
  const title = card.querySelector(".tab-title");
  const favicon = card.querySelector(".favicon");
  const slider = card.querySelector(".tab-volume");
  const value = card.querySelector(".tab-value");
  const mute = card.querySelector(".mute-button");
  card.dataset.managed = String(managed);
  title.textContent = tab.title || "Untitled tab";
  title.title = tab.title || "Untitled tab";
  card.querySelector(".tab-site").textContent = tabSite(tab);
  favicon.src = tab.favIconUrl || fallbackFavicon();
  favicon.addEventListener("error", () => { favicon.src = fallbackFavicon(); }, { once: true });
  setSlider(slider, volume);
  value.value = `${volume}%`;
  slider.disabled = restricted;
  mute.disabled = restricted;
  mute.setAttribute("aria-pressed", String(muted));
  mute.title = restricted ? "Browser pages cannot be captured" : (muted ? "Unmute" : "Mute");
  card.querySelector(".connection-label").textContent = restricted ? "Unavailable" : (managed ? "Mixed" : "Ready");

  slider.addEventListener("input", () => {
    const nextVolume = clampVolume(slider.value);
    setSlider(slider, nextVolume);
    value.value = `${nextVolume}%`;
  });
  slider.addEventListener("change", async () => {
    const nextVolume = clampVolume(slider.value);
    await saveSettings(withSiteVolume(settings, tab.url, nextVolume));
    await applyTabAction(card, {
      type: MESSAGE.SET_TAB_VOLUME,
      tabId: tab.id,
      volume: nextVolume,
      muted,
    }, "Could not connect this tab.");
  });
  mute.addEventListener("click", async () => {
    await applyTabAction(card, {
      type: MESSAGE.SET_TAB_MUTED,
      tabId: tab.id,
      volume,
      muted: !muted,
    }, "Could not change mute.");
  });
  card.querySelector(".reset-tab").addEventListener("click", async () => {
    await saveSettings(withSiteVolume(settings, tab.url, DEFAULT_VOLUME));
    await applyTabAction(card, { type: MESSAGE.RESET_TAB, tabId: tab.id }, "Could not reset this tab.");
  });
  card.querySelector(".release-button").addEventListener("click", () => applyTabAction(
    card,
    { type: MESSAGE.RELEASE_TAB, tabId: tab.id },
    "Could not release this tab.",
  ));
  return card;
}

function renderMaster() {
  const master = audioState.masterVolume ?? settings.masterVolume;
  setSlider(elements.master, master);
  elements.masterValue.value = `${master}%`;
}

function renderTabs() {
  elements.list.replaceChildren(...visibleTabs.map(buildTabCard));
  elements.count.textContent = String(visibleTabs.length);
  elements.empty.hidden = visibleTabs.length > 0;
  elements.list.setAttribute("aria-busy", "false");
}

async function restoreRememberedMix() {
  const failures = [];
  if (audioState.masterVolume !== settings.masterVolume) {
    const response = await sendMessage({ type: MESSAGE.SET_MASTER_VOLUME, volume: settings.masterVolume });
    if (response?.ok) audioState = response.state;
    else failures.push("master volume");
  }
  for (const tab of visibleTabs) {
    const preferred = volumeForSite(settings, tab.url);
    if (!audioState.tabs[String(tab.id)] && preferred !== DEFAULT_VOLUME && !isRestrictedUrl(tab.url)) {
      const response = await sendMessage({
        type: MESSAGE.SET_TAB_VOLUME,
        tabId: tab.id,
        volume: preferred,
        muted: false,
      });
      if (response?.ok) audioState = response.state;
      else failures.push(tab.title || "a tab");
    }
  }
  if (failures.length) showNotice(`Some saved settings could not be restored: ${failures.join(", ")}.`);
}

async function refresh() {
  elements.list.setAttribute("aria-busy", "true");
  showNotice("");
  try {
    await Promise.all([loadSettings(), loadAudioState()]);
    const tabs = await callChrome(chrome.tabs.query.bind(chrome.tabs), {});
    visibleTabs = relevantTabs(tabs);
    await restoreRememberedMix();
    renderMaster();
    renderTabs();
  } catch (error) {
    showNotice(`TabMixer could not load. ${error.message}`);
    elements.list.setAttribute("aria-busy", "false");
  }
}

elements.master.addEventListener("input", () => {
  setSlider(elements.master, elements.master.value);
  elements.masterValue.value = `${clampVolume(elements.master.value)}%`;
});
elements.master.addEventListener("change", async () => {
  const volume = clampVolume(elements.master.value);
  await saveSettings({ ...settings, masterVolume: volume });
  const response = await sendMessage({ type: MESSAGE.SET_MASTER_VOLUME, volume });
  if (!response?.ok) showNotice(`Could not set master volume. ${response?.error || ""}`);
  else audioState = response.state;
  renderMaster();
});
elements.refresh.addEventListener("click", refresh);
elements.resetAll.addEventListener("click", async () => {
  await saveSettings(DEFAULT_SETTINGS);
  const response = await sendMessage({ type: MESSAGE.RESET_ALL });
  if (response?.ok) audioState = response.state;
  else showNotice(`Could not reset the mixer. ${response?.error || ""}`);
  renderMaster();
  renderTabs();
});
elements.releaseAll.addEventListener("click", async () => {
  const response = await sendMessage({ type: MESSAGE.RELEASE_ALL });
  if (response?.ok) audioState = response.state || { masterVolume: settings.masterVolume, tabs: {} };
  else showNotice(`Could not release audio. ${response?.error || ""}`);
  renderTabs();
});
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === MESSAGE.AUDIO_STATE_CHANGED) {
    audioState = message.state;
    renderMaster();
    renderTabs();
  }
});

refresh();
