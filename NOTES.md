# Notes

## v0.3.2 — security hardening pass (2026-04-26)

Five high-value items from the security review. None of these were known to be exploited, but they reduce attack surface and remove obvious leaks.

### CDN URL allowlist

`src/lib/seventv.ts` — `normalizeEmoteSet` previously trusted whatever `host.url` the 7TV API returned and only fixed up the protocol-relative form. New `safeHostUrl()` resolves the URL, requires `https:`, and requires the host to be on an allowlist (currently `cdn.7tv.app`). Records that don't resolve are dropped silently.

If the 7TV API is ever compromised or spoofed, the worst it can do now is starve the catalog — not exfiltrate the YouTube watch URL or trigger arbitrary outbound requests from the chat origin.

### `referrerpolicy="no-referrer"` on every emote img

`src/content/renderer.ts`, `src/content/autocomplete.ts`, `src/content/picker.ts` — every `<img>` we create for emote rendering now sets `referrerPolicy = 'no-referrer'`. Without this, every image fetch leaked the full YouTube watch URL (with video ID + query params) to the 7TV CDN on every render, including for users who'd never opened the picker.

### `https://`-only content script match

`manifest.config.ts` — `matches` was `*://www.youtube.com/live_chat*`. Now `https://www.youtube.com/live_chat*`. YouTube redirects http→https in practice; this just refuses to run on the unencrypted variant in case that changes.

### Sender verification on `chrome.runtime.onMessage`

`src/background/index.ts` and `src/content/chat.ts` — both listeners now reject any message where `sender.id !== chrome.runtime.id`. By MV3 default `onMessage` only receives same-extension messages (anything external would need `externally_connectable` in the manifest, which we don't set), but the explicit check documents the contract and resists future regressions.

### Bounded catalog fetch

`src/lib/seventv.ts` — `fetchEmoteSet` now uses an `AbortController` with a 10 s timeout, rejects responses with `Content-Length > 10 MB`, requires `application/json` content type, and explicitly sets `credentials: 'omit'`. Real catalogs are well under 1 MB; the cap is loose enough not to interfere but tight enough to prevent a malicious response from wedging the SW or triggering a giant `JSON.parse`.

### Security backlog (deferred)

Items from the same review, kept here so they aren't lost. None are known-exploited; revisit when convenient.

- **Sanitize emote names from the API** — reject names with chars outside `[A-Za-z0-9_\-]+` during normalization. Tokenizer regex already protects rendering, but the picker stores and displays the raw name.
- **Validate `emoteSetId` in the popup** — restrict to the 26-char Crockford-base32 shape 7TV uses before saving.
- **Clamp `emoteSize` in `getSettings()`** — defensive bound so externally-tampered storage can't render a 10000 px image.
- **Explicit MV3 `content_security_policy` in the manifest** — defaults are already strict; declaring it documents intent.
- **Narrow the picker's mount-time MutationObserver** — currently observes `document.body` with `subtree: true`. Already disconnects after first mount, but a tighter scope reduces exposure to attacker-controlled DOM.
- **try/catch around top-level mutation callbacks** — if `processMessage` ever throws on a malformed message, the observer callback shouldn't bubble.
- **Confirm `__DEBUG__` is hard-`false` in prod builds** — verify Vite `define` strips the dead branches; grep the prod bundle for `[ytce]` strings.
- **Cap stored catalog size** — handle `chrome.storage.local` quota errors gracefully on `setCachedCatalog`.
- **Drop the `data-name` attribute on the input wrapper** — small gratuitous channel, nothing reads it today.
- **Add a SECURITY.md** — document the trust boundary (7TV API is the only external trust source, no telemetry). Useful before any Chrome Web Store submission.

---

## v0.3.1 — send-strips-emote + dark-mode label colour (2026-04-24)

Two follow-ups from the v0.3.0 test pass.

### Issue C — sending stripped the emote when wrapped in other text

`asdasd :aga: asdasdasd` sent through chat as `asdasd  asdasdasd`. v0.3.0 set `img.alt = ''` on the wrapped image and relied on a visually-hidden `<span>:NAME:</span>` next to it to keep `:NAME:` in textContent/innerText. YouTube's send pipeline doesn't extract from that text node — it serialises chat input the same way it renders its own custom emojis: `<img alt=":foo:">` round-trips by reading `alt`. With our alt cleared, YouTube saw an image with no extractable text and just dropped it.

`src/content/renderer.ts` — `buildEmoteInputWrapper` now sets `img.alt = ':NAME:'` and the wrapper contains only the image (no hidden text span). `src/content/chat.css` drops the now-unused `.ytce-input-emote-text` rule.

### Issue D — emote labels were black in YouTube dark mode

`.ytce-autocomplete` and `.ytce-picker-panel` used `color: var(--yt-spec-text-primary, #0f0f0f)`. The chat iframe doesn't expose `--yt-spec-text-primary` (that's a main-page YouTube variable), so we fell through to the dark fallback in both light and dark modes. Switched to `var(--yt-live-chat-primary-text-color, var(--yt-spec-text-primary, #0f0f0f))` which is the chat-iframe-scoped variable that follows YouTube's theme.

---

## v0.3.0 — autocomplete fix + Twitch-parity in-input emotes (2026-04-23)

Two follow-up issues from the v0.2.0 test pass.

### Issue A — autocomplete Tab/click was still silently doing nothing

`src/content/autocomplete.ts` — `insertSelected` previously held onto a `currentCaret` reference captured during `onInput` (i.e. at typing time). YouTube's Polymer-backed input rebuilds its text nodes on every keystroke, so by the time Tab or click fires, the cached `caret.textNode` is already detached from the DOM. `range.setStart(detachedNode, …)` doesn't throw — it just produces an unanchored range that the selection API silently ignores, so `execCommand('insertText')` finds no live selection and inserts nothing.

Fix: re-fetch the caret at insertion time by calling `getWordAtCaret(input)` inside `insertSelected`. The cached `currentCaret` field (and its `CaretWord` import) are now removed since they were dead weight after the fix.

This is why the picker worked but autocomplete didn't — picker called `insertAtCaret` which uses live selection; autocomplete used a frozen reference.

### Issue B — selecting an emote should show the IMAGE in the input, not just `:NAME:`

Twitch-parity behaviour: when you pick an emote, the input field shows the actual emote image, not the colon-wrapped shortcode. The message that gets *sent* to chat must still be the shortcode so the chat-side renderer can render it.

New file `src/content/wrap-input.ts` — after every insertion (autocomplete, picker, manual typing) we walk the input's text nodes and replace any `:NAME:` matches with a wrapper:

```html
<span class="ytce-input-emote" contenteditable="false">
  <img src="…" alt="">
  <span class="ytce-input-emote-text">:NAME:</span>
</span>
```

- `contenteditable=false` on the wrapper makes the whole emote behave as a single editing unit — Backspace deletes it whole, the caret can't land inside it.
- The hidden text span uses the standard "visually hidden" CSS pattern (`position: absolute; width:1px; height:1px; clip: rect(0 0 0 0); clip-path: inset(50%);`) so it stays in `.textContent` AND `.innerText`. YouTube's serializer-on-send extracts the colon-wrapped form when the user hits Enter — message hits chat as `:NAME:` and gets re-rendered by the chat-side observer.
- TreeWalker `acceptNode` rejects subtrees inside existing `.ytce-input-emote` wrappers so we don't double-wrap on subsequent passes.

`src/content/renderer.ts` — added `buildEmoteInputWrapper(rec, sizePx)` that constructs the wrapper. Reuses the existing `buildEmoteImage` so URL/srcset selection stays in one place.

`src/content/picker.ts` and `src/content/autocomplete.ts` — both attach functions now take a `getEmoteSize: () => number` second arg and call `wrapInputEmotes(input, catalog, getEmoteSize())` after their `insertAtCaret` / `replaceWordAtCaret` call.

`src/content/chat.ts` — wires the size getter through. Imports `DEFAULT_SETTINGS` so the fallback is centralised.

`src/content/chat.css` — three new rules: `.ytce-input-emote` (inline-block, vertical-align text-bottom, user-select none), `.ytce-input-emote img` (inline-block, vertical-align middle, pointer-events none), and `.ytce-input-emote-text` (visually hidden).

### Caret placement after wrap

`wrapInputEmotes` calls `setCaretToEnd(input)` after any mutation. This is correct for the common "type, then pick" flow but jarring if a user inserts an emote into the middle of an existing message. Mid-text caret preservation needs offset-mapping across split text nodes — deferred to a later pass.

---

## v0.2.0 — fixes from first-test feedback (2026-04-23)

All four issues from the v0.1.0 test pass are addressed.

### Issue 1 + 3 — autocomplete & picker insertion now work

`src/content/input.ts` — `replaceWordAtCaret` and `insertAtCaret` rewritten to use `document.execCommand('insertText', ...)`. The previous implementation mutated `textNode.nodeValue` directly and dispatched a synthetic `InputEvent`, which YouTube's Polymer-backed input element didn't observe (its tracked length stayed at 0, so the send button stayed disabled and the visible text reverted on the next render tick).

`execCommand` is deprecated but it's still the only reliable way to integrate with editor frameworks that own their own state. The modern replacement (the `EditContext` API) isn't broadly available in Chrome stable yet.

### Issue 2 — emotes are colon-wrapped

Inserted emotes now write `:NAME: ` (colon-wrapped + trailing space) into chat. The tokenizer now matches `/:([A-Za-z0-9_\-]+):/g` and looks names up via `catalog.byLower` (case-insensitive — the surrounding colons already prevent accidental tokenisation of English words, so `:kekw:` and `:KEKW:` both render). Picker tile titles also show `:NAME:` so users see what gets typed. Tests rewritten accordingly.

### Issue 4 — emotes survive virtual-scroll recycling

`src/content/observer.ts` rewritten. We dropped the `data-ytce-processed` flag and now use a `WeakMap<HTMLElement, string>` content fingerprint plus `characterData: true` on the MutationObserver.

The fingerprint is the message body's `textContent`. After we replace `:KEKW:` with an `<img>`, `textContent` drops from `:KEKW:` to `""` (img contributes nothing). We store that post-render value as the fingerprint, so the self-mutation callback that follows is recognised as a no-op. When YouTube recycles a renderer for a new message and rewrites the body, the fingerprint differs and we re-tokenize.

### Bonus — URL guard in renderer

`src/content/renderer.ts` now skips text nodes inside `<a>` elements, so an auto-linkified URL like `https://foo.com/:WW:bar` doesn't render an emote in the middle of the URL.

---

## To eyeball in the next manual test pass

- Picker tile **titles** show `:NAME:` — tile **labels** in the autocomplete dropdown still show bare `NAME`. That's deliberate (consistent with how Twitch shows it) but worth a sanity check that it doesn't feel inconsistent with the picker.
- Scrolling up through chat history — fingerprint check should make re-processing idempotent, but worth watching the perf profile / DevTools for any runaway mutation loops.
- Edge case: if a user types `:KEKW:` manually (without going through autocomplete), it should still render. Tested in the unit suite, worth confirming in real chat.
- Edge case: paste `:KEKW:` from elsewhere into the input — `execCommand('insertText')` should be irrelevant here (the user did the typing); chat still renders the message. Confirm.

## Test status (after v0.3.2)

- `npm test` → all passing
- `npm run typecheck` → clean
- `npm run build` → clean (small bump from 0.3.1 for URL allowlist + bounded fetch)

## To eyeball after v0.3.0

- Autocomplete Tab and click should now both insert the emote, and the input should show the image (not `:NAME:`).
- Picker click should also show the image in the input.
- Sending the message should still produce a message with the emote rendered correctly in chat (the `:NAME:` text is hidden but present in textContent).
- Backspace should delete the whole emote at once (contenteditable=false behaviour). Confirm.
- Mid-text insertion: caret jumps to end after wrap. Known v0.3 limitation, fine for now.
