# Privacy Policy — Live Chat Emotes

_Last updated: 14 May 2026_

Live Chat Emotes is a browser extension that renders 7TV emotes in YouTube
live chat. This policy explains exactly what data the extension touches.

## What the extension does NOT do

- It does **not** collect, store, or transmit any personal information.
- It does **not** use analytics, telemetry, crash reporting, or trackers.
- It does **not** sell or share any data with anyone.
- It does **not** read, log, or transmit the content of chat messages
  anywhere off your device.

## Network requests

The extension makes network requests to exactly two places, both part of the
public 7TV service:

- `https://7tv.io/v3/emote-sets/{id}` — to download the catalogue of the
  emote set you have configured.
- `https://cdn.7tv.app/emote/{id}/...` — to load the emote images
  themselves.

Image requests are sent with `referrerPolicy: no-referrer`, so the YouTube
page URL you are watching is not disclosed to the 7TV CDN.

No other servers are contacted.

## Data stored on your device

The extension stores a small amount of configuration locally using the
browser's `chrome.storage.local` API:

- Your chosen 7TV emote set ID
- Your emote size preference
- The "extension enabled" and "autocomplete" on/off toggles
- A cached copy of the current emote-set catalogue (to avoid re-downloading
  it on every page)

This data never leaves your device and is removed if you uninstall the
extension.

## Contact

Questions about this policy can be raised as an issue at
https://github.com/magpielabs-co/live-chat-emotes.
