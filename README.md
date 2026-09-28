# TabMixer

TabMixer is a privacy-first per-tab audio mixer for Chromium browsers. It provides independent 0–200% volume controls, mute and reset actions, a master volume, and remembered volume preferences for each website.

## Features

- Mix every currently audible tab from one compact popup.
- Set per-tab volume from 0% to 200%.
- Mute, reset, or release individual tabs.
- Apply a shared master volume and reset or release the whole mixer.
- Remember preferred volume by hostname using local extension storage.
- Continue processing audio after the popup closes.
- Clearly disable controls for browser-owned and other restricted pages.
- No analytics, ads, remote code, accounts, network requests, or host permissions.

## Install locally

1. Download and unzip the release, or use this source folder.
2. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select the folder that directly contains `manifest.json`.
5. Pin TabMixer from the browser's extensions menu.
6. Start audio on a normal website, open TabMixer, and move that tab's slider.

The packaged ZIP is intended for store upload. Chrome and Edge do not install arbitrary local ZIP files directly; unzip it and use **Load unpacked** for local testing.

## How it works

The popup queries browser tab metadata and shows tabs that are audible, muted by the browser, or already connected to TabMixer. A control interaction asks the MV3 service worker for a tab-capture stream ID. The service worker passes that short-lived ID to an offscreen document, which owns a persistent Web Audio graph:

```text
captured tab stream → per-tab GainNode → master GainNode → speakers
```

Capturing normally suppresses the tab's original output. TabMixer explicitly reconnects the captured stream to the audio destination, which prevents doubled audio while allowing gain control. **Release audio** stops TabMixer's capture so the browser resumes its ordinary playback path.

Site preferences and the master preference are stored in `chrome.storage.local`. Active audio streams never leave the browser and are not recorded.

### MV3 lifecycle

The service worker can sleep without interrupting playback because the offscreen document owns the `AudioContext`, streams, and gain nodes. The offscreen document reports a small, non-sensitive state snapshot to newly opened popups. Closing a tab stops its session, and ended capture tracks clean themselves up.

### Known platform limits

- Chromium does not allow extensions to capture browser settings pages, extension pages, the Chrome Web Store, DevTools, and some protected content.
- A tab appears only after Chromium marks it audible, it is browser-muted, or TabMixer is already managing it.
- Volume boost can clip or distort loud source audio. Start low and protect your hearing.
- `file://` pages require the user to enable **Allow access to file URLs** on the extension details page.
- Tab capture behavior is provided by Chromium; Firefox is not supported by this MV3 build.

## Permissions

| Permission | Why it is needed |
| --- | --- |
| `tabs` | List audible tabs and display their title, URL hostname, and favicon. |
| `tabCapture` | Obtain audio from a user-selected tab for local gain processing. |
| `offscreen` | Keep the Web Audio graph alive when the popup and service worker close. |
| `storage` | Save master volume and per-site volume preferences locally. |

TabMixer requests no host permissions, so it cannot read or alter webpage contents.

## Development

Requires Node.js 20 or newer; there are no third-party package dependencies.

```sh
node scripts/generate-icons.mjs
node scripts/lint.mjs
node --test
node scripts/check-manifest.mjs
node scripts/package-release.mjs
```

The last command creates `release/tabmixer-v1.0.0.zip`. `npm run check` and `npm run package` are equivalent when npm is available.

## Release checklist

See [docs/PUBLISHING.md](docs/PUBLISHING.md) for store listing copy, required disclosures, screenshots, manual acceptance tests, and submission steps. See [PRIVACY.md](PRIVACY.md) for the publishable privacy policy.

## License

MIT — see [LICENSE](LICENSE).
