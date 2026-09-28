# Publishing TabMixer

This guide covers Chrome Web Store and Microsoft Edge Add-ons submission for v1.0.0.

## Before submission

1. Replace the contact placeholder in `PRIVACY.md` with a monitored address or support URL.
2. Host the privacy policy at a stable public HTTPS URL (for example, a public repository page or your website).
3. Run the automated checks and build the release ZIP.
4. Complete the manual test matrix below in current stable Chrome and Edge on at least one Windows or macOS machine.
5. Capture store screenshots at 1280×800 or 640×400. Show the popup with two or more genuine audible tabs, one actively mixed.
6. Prepare a 128×128 icon (already included) and optional 440×280 promotional tile.

## Manual acceptance tests

| Scenario | Expected result |
| --- | --- |
| Fresh install, no audio | Empty state appears; no console errors. |
| One audible HTTPS tab | Tab appears after refresh with correct title, hostname, and favicon. |
| First slider change | Audio continues without doubling; chosen gain is audible; state says **Mixed**. |
| Popup closed and reopened | Audio level continues and session state is restored in the popup. |
| Volume set above 100% | Audio is boosted; slider supports up to 200%. |
| Mute and unmute | Audio reaches silence and returns at the prior volume. |
| Reset tab | Tab returns to 100% and unmuted. |
| Master volume | All connected tabs change proportionally. |
| Release tab / all | Capture ends and ordinary browser audio resumes. |
| Tab closes during capture | Session cleans up without affecting other tabs. |
| `chrome://settings` / `edge://settings` | Controls are disabled and the page is labeled unavailable. |
| Browser restart | Saved site/master preferences remain; old streams do not falsely appear active. |
| Two browser windows | Audible tabs from both windows appear and can be controlled independently. |
| Uninstall | Extension data and active processing are removed by the browser. |

Also inspect the service worker and offscreen document consoles from the extensions page during tests.

## Chrome Web Store

1. Register a developer account in the Chrome Web Store Developer Dashboard and complete any required identity/payment steps.
2. Choose **New item** and upload `release/tabmixer-v1.0.0.zip`.
3. Add the listing copy and assets below.
4. In **Privacy**, declare the single purpose as per-tab audio volume control. Disclose tab metadata and website hostnames as handled data. State that data is processed locally and is not sold or transferred.
5. Justify each permission using the text in the README permission table. Do not claim that no data is handled; tab metadata and hostnames are handled locally.
6. Add the hosted privacy-policy URL and support contact.
7. Set visibility and distribution, save the draft, then submit for review.

### Suggested listing copy

**Name:** TabMixer

**Summary (132 characters maximum):** Control each audible tab independently with volume boost, mute, master volume, and private per-site preferences.

**Detailed description:**

> Bring every audible browser tab into one focused mixer. TabMixer gives each tab an independent 0–200% volume control, mute and reset actions, plus a shared master volume.
>
> Your preferred level is remembered by website, while active audio processing stays entirely on your device. Release any tab at any time to return it to normal browser playback.
>
> • Independent controls for audible tabs  
> • Safe, obvious mute, reset, and release actions  
> • 0–200% range and shared master volume  
> • Per-site preferences stored locally  
> • No ads, analytics, accounts, remote code, or host permissions
>
> Chromium protects internal pages and some protected media from capture. Boosting already-loud audio may cause clipping; increase volume carefully.

**Category:** Productivity (or Accessibility, if available and appropriate at submission time)

## Microsoft Edge Add-ons

1. Sign in to Partner Center and create a new extension submission.
2. Upload the same ZIP; Edge supports this Chromium MV3 package.
3. Use the same listing assets, permission explanations, and privacy disclosures.
4. Complete Edge's markets, properties, and age-rating fields, then submit.

## Versioning and release

Update the version in both `manifest.json` and `package.json`. Run all checks, build the new ZIP, manually smoke-test the unpacked build, then tag the commit as `vX.Y.Z`. The included workflow validates pushes and pull requests and attaches the ZIP to GitHub Releases created from `v*` tags.
