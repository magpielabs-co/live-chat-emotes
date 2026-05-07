# YouTube 7TV Chat Emotes

Chrome (MV3) extension that renders 7TV emotes in YouTube live chat, with `:`-triggered autocomplete and an emote picker next to the chat input.

See [PLAN.md](./PLAN.md) for scope, architecture, and milestones.

## Dev

```bash
npm install
npm run dev
```

Then in Chrome: open `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select the generated `dist/` folder. HMR works for the popup and most module boundaries; reload the extension (and refresh the YouTube tab) after service-worker or manifest changes.

## Build

```bash
npm run build       # outputs dist/
npm run typecheck   # tsc --noEmit
npm run test        # vitest
```

## What it does (v1)

- Tokenizes live-chat message text and replaces matching shortcodes with 7TV emote images.
- Default emote set is hardcoded in `src/lib/storage.ts` (`DEFAULT_EMOTE_SET_ID`). Override via the popup.
- Autocomplete: start typing `:` in chat. Arrow keys to navigate, Tab/Enter to insert, Esc to close.
- Emote picker: click the smiley button next to the chat input.

## No telemetry

No analytics, no error reporting, no network calls beyond the 7TV API itself. `__DEBUG__`-gated `console.debug` lines are stripped from production builds.
# live-chat-emotes
