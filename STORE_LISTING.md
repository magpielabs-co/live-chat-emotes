# Chrome Web Store listing — Live Chat Emotes

Copy-paste source for the Web Store submission form. Not shipped in the
extension package.

---

## Item name

```
Live Chat Emotes
```

## Summary (132 char max)

```
Render 7TV emotes in YouTube live chat, with :colon: autocomplete and an emote picker next to the chat input.
```

## Category

Suggested: **Social & Communication** (alternative: Fun)

## Language

English

---

## Detailed description

```
Live Chat Emotes brings 7TV emotes to YouTube live chat.

Messages that contain a matching :shortcode: are rendered inline as the
emote image, so chat looks the way it does on other platforms instead of
showing raw text.

FEATURES

• Inline emote rendering — matching :shortcode: text in live-chat messages
  becomes the 7TV emote image.
• Autocomplete — start typing ":" in the chat input and a dropdown appears.
  Arrow keys to navigate, Tab or Enter to insert, Esc to close.
• Emote picker — a button next to the chat input opens a searchable grid of
  every emote in the current set.
• Configurable emote set — paste any 7TV emote set ID in the popup. A
  curated general-purpose set is loaded by default.
• Live size adjustment — a slider in the popup resizes already-rendered
  emotes immediately.
• No telemetry — no analytics, no error reporting, and no third-party calls
  beyond 7TV itself.

PRIVACY

This extension talks to exactly two places, both part of the public 7TV
service: the 7TV API for emote-set catalogues and the 7TV CDN for the emote
images. There is no analytics, no tracking, and no remote code. Your
settings are stored locally and never leave your device. Full policy:
https://github.com/magpielabs-co/live-chat-emotes/blob/main/PRIVACY.md

This extension is not affiliated with, endorsed by, or sponsored by 7TV or
YouTube. "7TV" and "YouTube" are trademarks of their respective owners.
```

---

## Single purpose declaration

```
Live Chat Emotes has a single purpose: to display 7TV emotes in YouTube
live chat and to help users insert those emotes into the chat input.
```

## Permission justifications

**`storage`**
```
Used to save the user's settings (chosen 7TV emote set ID, emote size, and
on/off toggles) and to cache the emote-set catalogue locally so it does not
need to be re-downloaded on every page load. No data is transmitted off the
device.
```

**Host permission — `https://7tv.io/*`**
```
Required to download the catalogue of the user's configured 7TV emote set
from the public 7TV API.
```

**Host permission — `https://cdn.7tv.app/*`**
```
Required to load the emote image files themselves from the 7TV CDN.
```

**Content script — `https://www.youtube.com/live_chat*`**
```
The content script runs only on the YouTube live-chat document. It is needed
to detect :shortcode: text in incoming messages, render emotes inline, and
add the autocomplete dropdown and emote-picker button to the chat input.
```

## Remote code

```
No. All code is contained in the extension package. Nothing is fetched and
executed at runtime — the only network requests are for the 7TV emote
catalogue (JSON) and emote images.
```

## Data usage disclosures (Privacy practices tab)

Check these on the form:

- Does NOT collect or use personally identifiable information.
- Does NOT collect health information, financial info, authentication info,
  personal communications, location, web history, or user activity.
- Certify: data is not sold to third parties.
- Certify: data is not used for purposes unrelated to the single purpose.
- Certify: data is not used to determine creditworthiness / for lending.

**Privacy policy URL:**
```
https://github.com/magpielabs-co/live-chat-emotes/blob/main/PRIVACY.md
```

---

## Assets

- [x] Screenshot, 1280×800 — `store-assets/screenshot-picker-1280x800.png`
      (emote picker open in YouTube live chat).
- [x] Store icon: 128×128 — `src/assets/icons/icon-128.png`.
- [ ] Optional: a second/third screenshot showing emotes rendered inline in
      chat messages — stronger listing, not required to submit.
- [ ] Optional small promo tile: 440×280.
- [ ] Optional marquee promo: 1400×560.
```
```
