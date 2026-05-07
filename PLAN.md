# YouTube 7TV Chat Emotes — Project Plan

A Chrome (MV3) extension that renders 7TV emotes in YouTube live chat, with an autocomplete dropdown and an emote picker next to the chat input.

---

## 1. Up‑front findings that shape the plan

Two things came out of the research that change the starting assumptions:

**Truffle's source code is not public.** The `trufflehq` GitHub org has ~10 public repos (CLI, design tokens, npm packages, a `chat-overlay` snippet) but the browser extension itself is closed source. We can't fork or read it. Anything we "borrow from Truffle" has to be reverse‑engineered from the installed extension — possible but slow and a moving target. Recommendation: don't anchor on Truffle as a code source; treat it only as a UX reference.

**The official 7TV browser extension already supports YouTube — but badly.** `github.com/SevenTV/Extension` (MIT, Vue 3 + TypeScript, last release v3.1.6 in March 2025) has a `src/site/youtube.com/` module with `ChatModule`, `ChatData`, `ChatAutocomplete`, `ChatController`. However there are several open, long‑standing issues — #671 "YouTube features missing since 3.0", #975 "Youtube Support Still Scuffed", #1015 "Error on Youtube" — and the community consensus is that 7TV on YouTube is broken / unreliable enough that BTTV is the recommended workaround. So: their code is a goldmine for selectors and tokenizer logic, but their architecture (Vue components mounted into YouTube's DOM via a hook layer) is heavier than this v1 needs and is part of why their YouTube support is fragile.

**Implication for our plan.** We build a fresh, small, MV3 vanilla‑TypeScript extension. We use the SevenTV repo as a reference for selectors, the message‑tokenizing strategy, and the autocomplete approach — but we don't take on a Vue runtime, a hook framework, or multi‑platform abstractions we don't need. This keeps the surface area small enough that one person can maintain it, which is the failure mode that took out both Truffle and (apparently) 7TV's own YouTube support.

---

## 2. Scope

**In scope for v1**

- Chrome MV3 extension, distributed as unpacked first, store later.
- Render 7TV emotes inline in YouTube live chat messages.
- Autocomplete dropdown when typing `:partial` or matching word in the chat input.
- Emote picker UI: a button next to the chat input that opens a panel listing all loaded emotes with a search field.
- Settings popup: paste a 7TV emote set ID (or 7TV user ID) to load.
- Live chat surface only (the `youtube.com/live_chat?v=...` iframe). Premieres reuse the same iframe and should work for free; replays are explicitly out for v1.

**Out of scope for v1** (kept short so we don't drift)

- Per‑channel emote set mapping. v1 uses one global set.
- Sending emote shortcodes that other extension users will see as emotes — viable but explicit non‑goal for v1.
- Zero‑width / overlay emotes. Big rendering complexity, defer to v2.
- Animated‑emote preferences.
- VOD chat replay.
- Regular video comments (different DOM, different lifecycle).
- Firefox/Edge support.
- BTTV / FFZ providers.
- 7TV EventAPI live updates (emote add/remove). v1 fetches once at iframe load and caches.

---

## 3. Tech stack & rationale

| Choice | Pick | Why |
| --- | --- | --- |
| Manifest | MV3 | Required for Chrome Web Store new submissions. |
| Language | TypeScript | API responses have a defined shape; types catch most mistakes. |
| Build | Vite + `@crxjs/vite-plugin` | Best‑in‑class MV3 dev experience: HMR for content scripts, automatic manifest handling. |
| UI framework | None — vanilla DOM + small CSS | We're injecting into someone else's DOM. A framework runtime adds weight, attack surface, and conflict risk for ~10 small UI bits. The 7TV extension's Vue layer is part of why YouTube support is brittle. |
| State / settings | `chrome.storage.local` | Standard, no setup. |
| HTTP | `fetch` | No need for axios. |
| Lint/format | ESLint + Prettier | Cheap. |
| Tests | Vitest for pure logic (tokenizer, autocomplete matcher); manual for DOM | DOM‑injection tests against real YouTube are not worth the setup for v1. |

---

## 4. Architecture

```
┌───────────────────────────────────────────────────────────┐
│ Service Worker (background.ts)                            │
│  • Caches 7TV emote set in memory + chrome.storage        │
│  • Single fetcher (so both content scripts share one)     │
│  • Listens for chrome.storage changes, broadcasts to tabs │
└──────▲────────────────────────────────────────────▲───────┘
       │ messages                                   │
┌──────┴──────────────────┐         ┌───────────────┴───────┐
│ Content script: parent  │         │ Content script: chat  │
│  matches: youtube.com/* │         │  matches: */live_chat*│
│  Currently a no‑op stub │         │  All real work here   │
│  (kept for future:      │         │                       │
│   theatre mode, etc.)   │         │  • Tokenizer          │
└─────────────────────────┘         │  • Mutation observer  │
                                    │  • Autocomplete UI    │
                                    │  • Picker UI          │
                                    │  • Send‑shortcode     │
                                    │    rewrite (v2)       │
                                    └───────────────────────┘
                                                ▲
                                                │
┌───────────────────────────────────────────────┴──────────┐
│ Popup (settings)                                         │
│  • Paste emote set ID / 7TV user ID                      │
│  • "Reload emotes" button                                │
│  • Show currently loaded set name + emote count          │
└──────────────────────────────────────────────────────────┘
```

Two key decisions worth being explicit about:

**Run the chat content script against the iframe URL, not the parent.** YouTube's live chat is a separate document at `https://www.youtube.com/live_chat?v=VIDEO_ID`. We get cleaner access by matching that URL directly in the content script's `matches`, rather than trying to `iframe.contentDocument.querySelector` from the parent. This is how both 7TV and HyperChat do it.

**Service worker owns the cache.** Both the parent‑page script (currently stub) and the chat iframe script share a single in‑memory copy of the emote set. If the user opens five live streams, we fetch once.

---

## 5. File layout

```
youtube-chat-emotes/
├─ manifest.json                  # generated by @crxjs from manifest.config.ts
├─ manifest.config.ts
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
├─ src/
│  ├─ background/
│  │  └─ index.ts                 # service worker: cache + message router
│  ├─ content/
│  │  ├─ chat.ts                  # entry point, runs in live_chat iframe
│  │  ├─ chat.css                 # picker, autocomplete, emote img styles
│  │  ├─ observer.ts              # MutationObserver wrapper
│  │  ├─ tokenizer.ts             # text → [text|emote] tokens
│  │  ├─ renderer.ts              # tokens → DOM nodes, splices into #message
│  │  ├─ autocomplete.ts          # dropdown widget over the chat input
│  │  ├─ picker.ts                # emote panel widget
│  │  └─ input.ts                 # bridges contenteditable input ↔ widgets
│  ├─ popup/
│  │  ├─ index.html
│  │  ├─ popup.ts
│  │  └─ popup.css
│  ├─ lib/
│  │  ├─ seventv.ts               # 7TV API client
│  │  ├─ types.ts                 # SevenTVEmote, SevenTVEmoteSet, etc.
│  │  ├─ messages.ts              # typed background↔content messages
│  │  └─ storage.ts               # typed chrome.storage wrapper
│  └─ assets/
│     └─ icons/                   # 16/32/48/128 PNG
└─ tests/
   ├─ tokenizer.test.ts
   └─ autocomplete.test.ts
```

---

## 6. Data flow

**Loading an emote set**

1. Popup or first‑run default writes `emoteSetId` to `chrome.storage.local`.
2. Service worker sees the change, calls `GET https://7tv.io/v3/emote-sets/{id}`.
3. Response is normalized into a flat `Map<shortcode, EmoteRecord>` plus a `shortcode[]` sorted list (for autocomplete prefix scans). Both keyed on lowercased shortcode for case‑insensitive matching, with the original shortcode preserved on the record for display.
4. Cached in service‑worker memory and persisted to `chrome.storage.local` as a fallback.
5. Broadcast `{type: 'emotes_loaded', emotes}` to all tabs whose URL matches the chat iframe.

**Rendering an incoming message**

1. `observer.ts` watches `yt-live-chat-item-list-renderer #items` for added nodes.
2. For each `yt-live-chat-text-message-renderer`, find `#message`.
3. Walk text nodes only (don't touch existing emoji `<img>` or member badges).
4. For each text node: `tokenizer.ts` splits on whitespace, tests each token against the emote map, returns `[{type:'text', value}, {type:'emote', record}, ...]`.
5. `renderer.ts` rebuilds the text node's contents as a sequence of text + `<img class="ytce-emote" alt={shortcode} title={shortcode} src={cdnUrl(record, '1x')} srcset={…}>`.
6. Mark the message element with `data-ytce-processed="1"` so we don't re‑process if YouTube re‑renders it.

**Autocomplete**

1. `input.ts` attaches an `input` listener to `#input.yt-live-chat-text-input-field-renderer` (it's a contenteditable `<div>`).
2. On every input event, find the word at the caret. If it starts with `:` and has at least one character after the colon, query `autocomplete.ts`. Otherwise close the dropdown.
3. Match strategy: strip the leading `:`, prefix‑match the remainder against lowercased shortcodes. Cap at 8 results. Sort by shortcode length ascending (shorter matches rank higher — typing `:K` surfaces `:KEKW:` before `:KEKWait:`).
4. Render an absolutely‑positioned `<div class="ytce-autocomplete">` anchored above the input, list of results with image + shortcode.
5. Keyboard: ↑ / ↓ navigate, Tab / Enter inserts (replace the partial word with the full shortcode + a trailing space), Esc closes.
6. Mouse: hover highlights, click inserts.

**Picker**

1. On chat init, inject a button into the chat input bar (between emoji button and send button). Reuses YouTube's button styling via inheriting CSS.
2. Click toggles a panel with: search field at top, scrollable grid of emote thumbnails below, hover tooltip showing shortcode.
3. Click on an emote inserts its shortcode at the caret in the chat input (same insertion path as autocomplete).
4. Click outside / Esc closes.

---

## 7. The 7TV API in concrete terms

```
GET https://7tv.io/v3/emote-sets/{emote_set_id}
GET https://7tv.io/v3/users/{user_id}                  # for resolving "user → active set"
GET https://7tv.io/v3/users/{platform}/{platform_id}   # platform ∈ {twitch, youtube, ...}

CDN: https://cdn.7tv.app/emote/{emote_id}/{1x|2x|3x|4x}.{webp|avif|gif}
```

EmoteSet response shape (only fields we care about):

```ts
type SevenTVEmoteSet = {
  id: string;
  name: string;
  capacity: number;
  emote_count: number;
  emotes: Array<{
    id: string;             // emote ID (used in CDN URL)
    name: string;           // shortcode as it appears in chat
    flags: number;          // bit 1 = zero-width — out of scope v1
    data: {
      animated: boolean;
      host: {
        url: string;        // e.g. //cdn.7tv.app/emote/{id}
        files: Array<{
          name: string;     // e.g. "1x.webp"
          format: 'WEBP'|'AVIF'|'GIF'|'PNG';
          width: number;
          height: number;
        }>;
      };
    };
  }>;
};
```

For v1 we will:

- Detect AVIF support once at startup (`<img>` decode test) and prefer it; fall back to WEBP.
- Emit `srcset` with 1x and 2x for crisp display on hi‑DPI.
- Skip emotes flagged zero‑width during tokenization (don't render them at all rather than render incorrectly).

---

## 8. UX notes

**Emote sizing.** YouTube chat line height is ~20px. Default render at 24px tall (slightly larger than text, like Twitch). Allow user to override in settings to 20 / 24 / 28.

**Don't break YouTube emoji.** YouTube already inserts its own emoji `<img>` tags. Tokenize over text nodes only and skip non‑text children. Equally, don't process `yt-live-chat-paid-message-renderer` (Super Chats) for v1 — they have a custom layout and breaking them would be very visible.

**Autocomplete trigger.** `:` prefix only (Twitch‑native behaviour). No bare‑word matching — avoids surprise popups during normal typing and keeps the logic trivial.

**Picker discoverability.** The button needs an icon that's clearly not native YouTube. A simple custom SVG (e.g. a small face with a dot) works; avoid the 7TV logo for trademark reasons unless we explicitly want to invoke that brand.

---

## 9. Settings (popup)

Minimal v1 popup:

- Input: 7TV emote set ID (text) — saves on blur.
- Or: 7TV user ID + dropdown for which of their sets to use (resolved via `/v3/users/{id}`).
- Button: **Reload emotes** (forces a refetch).
- Status line: "Loaded *Set Name* — 142 emotes" or error message.
- Toggle: enable/disable the extension on the current tab (writes a per‑hostname pref).
- Toggle: enable/disable autocomplete.
- Number input: emote display size in px.

---

## 10. Milestones

Each milestone is a "you can ship this and it works" checkpoint, not a Jira ticket dump.

**M0 — Skeleton (½ day)**
Vite + crxjs scaffolded. Manifest valid. Popup loads. Content script logs from the live_chat iframe. No features yet. Verify install in Chrome via Load Unpacked.

**M1 — Render emotes (1–2 days)**
Hardcode the default set ID `01JF67B2AKMAFGCW334QYN9P4N`. Service worker fetches it. Content script tokenizes + renders. Verify against a live stream by typing known shortcodes in another window. Done = emotes appear inline in messages from anyone. Settings popup not required yet.

**M2 — Settings popup (½ day)**
Popup with set‑ID input, save/reload, status display. Done = user can change the loaded set without rebuilding.

**M3 — Autocomplete (1–2 days)**
Dropdown over chat input with keyboard nav and `:` + bare‑prefix triggers. Done = typing in chat shows suggestions; Tab/Enter inserts.

**M4 — Picker (1 day)**
Button next to chat input opens a panel with search + grid. Done = clicking an emote inserts it.

**M5 — Polish (1 day)**
AVIF detection, srcset, error states (network failure, invalid set ID), retain‑disable per hostname, icon set, README.

Total ballpark: ~6–8 working days for a single‑maintainer v1.

---

## 11. Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| YouTube ships a DOM rename and selectors break. | All selectors live in one `selectors.ts` constants file. Add an integration script that runs in the iframe and console‑warns if any expected selector returns null at boot. |
| `yt-live-chat-text-message-renderer` is re‑rendered after we mutate it (YouTube re‑runs on virtual scroll). | The `data-ytce-processed` flag re‑idempotents. Observer also re‑fires on subtree changes. |
| 7TV API rate limits / outages. | Cache to `chrome.storage.local` with a stale‑while‑revalidate behaviour. If fetch fails, use cache. Surface error in popup. |
| AVIF rendering causes jank on older machines. | Detect once and let the user override in settings. |
| User installs on a channel with a large emote set (1000+). | Tokenizer is O(words) with map lookup; fine. Autocomplete sorts on every keystroke — pre‑sort and use prefix‑bucket index if shortcode count > 500. |
| 7TV's official extension fixes their YouTube support and obsoletes ours. | Honestly: fine. Until they do, this is useful. The work is also small enough that this isn't a sunk‑cost concern. |
| Chrome Web Store review rejects the extension. | Single‑purpose declaration ("Add 7TV emotes to YouTube live chat"), narrow `host_permissions` (`https://*.youtube.com/*` and `https://7tv.io/*` and `https://cdn.7tv.app/*`), no remote code execution. Should sail through. |

---

## 12. Decisions (confirmed)

1. **Default emote set.** Hardcoded ID `01JF67B2AKMAFGCW334QYN9P4N` ([view on 7tv.app](https://7tv.app/emote-sets/01JF67B2AKMAFGCW334QYN9P4N)). Loaded on first run; user can override via the popup.
2. **Autocomplete trigger.** `:` prefix only. No bare‑word matching. Simpler logic, no risk of the dropdown popping up on normal typing, matches Twitch's native behaviour.
3. **Branding.** Placeholder name + placeholder icon generated at M0. Revisit before store submission.
4. **Telemetry.** None in production. Dev builds may emit `console.debug` logs gated behind a `DEBUG` build flag (stripped by Vite in production). No network calls ever, beyond the 7TV API itself.

### Implications for the plan

- **Autocomplete.** `input.ts` only queries when the current word at the caret starts with `:`. Token matched against `:partial` → strip the leading colon and prefix‑match against shortcodes. Simplifies `autocomplete.ts` (no substring pass, no min‑length guard).
- **First‑run UX.** Service worker seeds `chrome.storage.local` with the default set ID if unset, so the extension works out of the box with zero config.
- **Build.** Add a `define: { __DEBUG__: mode === 'development' }` entry in `vite.config.ts` and wrap all dev logs in `if (__DEBUG__)`. No analytics SDK, no error‑reporting SDK, no fingerprinting.

---

## 13. Plausible v2+ features (parking lot)

Not building these now, but worth knowing they fit cleanly on top of the v1 architecture:

- Per‑channel emote set mapping (settings UI gets a list, content script reads `videoId → channelId` from page metadata).
- Zero‑width / overlay emotes (renderer.ts gains a stacking pass; touches CSS more than JS).
- BTTV + FFZ providers (parallel `lib/bttv.ts`, `lib/ffz.ts`; tokenizer becomes provider‑agnostic).
- 7TV EventAPI subscription for live emote add/remove (background.ts opens a single SSE/WS).
- Send‑shortcode rewrite so other extension users see emotes you sent (input.ts hooks the send button — cosmetic only, raw text still goes over the wire).
- VOD live‑chat replay (different DOM lifecycle around scrubbing — needs its own observer strategy).
- Animation control (CSS `animation-play-state` + a hover state).
- Firefox build (drop in webextension‑polyfill, adjust manifest, second store listing).
