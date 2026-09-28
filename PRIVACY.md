# TabMixer Privacy Policy

**Effective date:** 28 September 2026

TabMixer is designed to process audio locally in your browser.

## Data TabMixer handles

To provide its mixer, TabMixer reads limited browser tab metadata: tab identifiers, titles, URLs, favicons, audible state, and mute state. When you choose to control a tab, Chromium provides TabMixer with that tab's audio stream. The extension processes the stream in memory using the browser's Web Audio API.

TabMixer stores your master-volume preference and per-site volume preferences in the browser's local extension storage. A per-site preference consists of a website hostname and a volume number.

## Data collection, sharing, and sale

TabMixer does not transmit, sell, share, or use personal data for advertising, profiling, analytics, or credit decisions. It has no servers, accounts, telemetry, advertising SDKs, or remote code. Captured audio is not recorded or saved and does not leave the browser through TabMixer.

## Data retention and deletion

Preferences remain in local extension storage until you reset them, clear the extension's data, or uninstall TabMixer. Releasing audio or closing the relevant tab ends the in-memory audio capture session.

## Permissions

TabMixer uses the `tabs`, `tabCapture`, `offscreen`, and `storage` extension permissions solely for the functions described above. It requests no website host permissions and cannot read webpage contents.

## Changes

If this policy changes, its effective date will be updated and the revised policy will be published with the extension listing or linked support materials.

## Contact

Before publishing, the developer must replace this section with a monitored support email address or support-page URL.
