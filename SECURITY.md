# Security Policy

## Reporting a vulnerability

If you find a security issue in Live Chat Emotes, please report it privately
rather than opening a public issue.

Open a [GitHub security advisory](https://github.com/magpielabs-co/live-chat-emotes/security/advisories/new)
for this repository. This keeps the report private until a fix is ready.

Please include steps to reproduce, the Chrome version, and the impact you
believe the issue has. You can expect an initial response within a few days.

## Supported versions

Only the latest released version is supported. Fixes ship in a new release;
there are no backported patches.

## Trust boundary

Live Chat Emotes is a single-purpose browser extension. Its security model is
intentionally small:

- **No telemetry.** The extension sends no analytics, error reports, or any
  other data to the maintainer or to third parties.
- **One external dependency.** The only network calls are to the public 7TV
  API (`https://7tv.io`) for emote-set catalogues and the 7TV CDN
  (`https://cdn.7tv.app`) for emote images. The list of trusted CDN hosts is
  allowlisted in source, so even a compromised 7TV API cannot redirect
  requests elsewhere.
- **No remote code.** All code ships in the extension package. Nothing is
  fetched and executed at runtime.
- **Minimal permissions.** The extension requests only `storage` and host
  access to the two 7TV domains above. The content script runs solely on
  `https://www.youtube.com/live_chat*`.
- **Local-only settings.** Your emote-set ID, size preference, and on/off
  toggles are stored via `chrome.storage.local` and never leave your machine.
- **No referrer leakage.** Emote image requests are sent with
  `referrerPolicy: no-referrer` so the YouTube watch URL is not exposed to the
  CDN.

## Hardening notes

Catalogue fetches are bounded (10 s timeout, 10 MB response cap, content-type
check, `credentials: 'omit'`). Both `chrome.runtime.onMessage` listeners reject
messages from any sender other than this extension. The catalogue is fetched
once per browser session by the service worker and cached locally.
