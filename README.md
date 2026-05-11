<p align="center">
  <img src="src/assets/icons/icon.svg" alt="Live Chat Emotes" width="128" height="128">
</p>

<h1 align="center">Live Chat Emotes (7TV)</h1>

<p align="center">
  Renders 7TV emotes in YouTube live chat, with <code>:</code>-triggered autocomplete and an emote picker next to the chat input.
</p>

---

## Features

- **Inline emote rendering** — replaces matching `:shortcode:` text in live-chat messages with 7TV emote images.
- **Autocomplete** — start typing `:` in the chat input and a dropdown appears. Arrow keys to navigate, Tab/Enter to insert, Esc to close.
- **Emote picker** — a button next to the chat input opens a searchable grid of every emote in the current set.
- **Configurable emote set** — paste any 7TV emote set ID in the popup. Default ships with a curated general-purpose set.
- **Live size adjustment** — slider in the popup; resizes already-rendered emotes immediately.
- **No telemetry** — no analytics, no error reporting, no third-party calls beyond 7TV itself.

## Install

> Chrome Web Store listing is in progress — link will appear here once the store review completes.

For now, install from source:

```sh
git clone https://github.com/magpielabs-co/live-chat-emotes.git
cd live-chat-emotes
npm install
npm run build
```

Then in Chrome:

1. Go to `chrome://extensions`
2. Enable **Developer mode** (top-right)
3. Click **Load unpacked** and pick the `dist/` folder this repo just produced
4. Open any YouTube livestream — emotes render inline as messages arrive

## Using it

**In a livestream**, the extension loads automatically. Type `:KE` in chat and you'll see suggestions; pick one and it inserts as the emote image (the message that gets sent is still the colon-wrapped shortcode, so the chat-side renderer turns it back into the emote for everyone with the extension).

**To change emote set**, click the extension's toolbar icon (the colon-mark logo). Paste a new set ID — you can copy it from any URL like `7tv.app/emote-sets/<ID>`. The status line under the input shows what's loaded.

**To resize emotes**, drag the slider in the popup. Already-rendered emotes resize live; you don't need to refresh chat.

**To turn it off temporarily**, untick "Extension enabled" in the popup. It re-enables on the next page load when you tick it back on.

## Privacy

This extension makes network calls to exactly two places, both on the public 7TV API:

- `https://7tv.io/v3/emote-sets/{id}` — to fetch the catalogue of a configured emote set.
- `https://cdn.7tv.app/emote/{id}/...` — for the emote images themselves.

That's it. No analytics, no error reporting, no third-party trackers, no remote code execution. Image fetches are sent with `referrerPolicy: no-referrer` so the YouTube watch URL doesn't leak to the CDN. The list of trusted CDN hosts is allowlisted in source — even a compromised 7TV API can't redirect image requests anywhere else.

Settings (your chosen emote set ID, size preference, on/off toggles) are stored locally via `chrome.storage.local` and never leave your machine.

## Development

```sh
npm install
npm run dev      # vite dev server with HMR for popup; reload extension after content-script edits
npm run build    # production bundle into dist/
npm run typecheck # tsc --noEmit
npm test         # vitest, pure-logic suite (tokenizer, autocomplete matcher)
```

The architecture and scope decisions are documented in [PLAN.md](./PLAN.md). Notable points:

- Manifest V3, vanilla TypeScript, no UI framework. The 7TV extension's Vue layer is part of why their YouTube support is fragile, and a framework runtime adds attack surface for ten small UI bits.
- The chat content script targets `https://www.youtube.com/live_chat*` directly (the iframe URL), not the parent page — cleaner DOM access, narrower permissions.
- The service worker owns the emote-set cache. Open ten livestreams and the catalogue is fetched once.
- All selectors live in `src/content/selectors.ts` so YouTube DOM renames are a single-file fix.

## Contributing

This is a one-maintainer project. The fastest way to get a change merged is to open an issue first describing what you're trying to fix or add — alignment before code. PRs without a discussion thread may sit.

Bug reports are very welcome. Include: Chrome version, the livestream URL where it broke (if public), and console output from the chat iframe if there's an error.

## Acknowledgements

- [7TV](https://7tv.app) for the emote set API and CDN.
- The [SevenTV/Extension](https://github.com/SevenTV/Extension) project (MIT) — used as a reference for YouTube DOM selectors and tokenizer strategy when planning v1.

This extension is not affiliated with, endorsed by, or sponsored by 7TV or YouTube. "7TV" and "YouTube" are trademarks of their respective owners.

## License

A LICENSE file will be added before the v1.0.0 Chrome Web Store submission. Until then, all rights reserved by default — but the intent is permissive open-source (likely MIT). If you want to use this code before the LICENSE lands, open an issue and I'll fast-track it.
