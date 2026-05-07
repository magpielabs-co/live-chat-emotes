import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json';

export default defineManifest({
  manifest_version: 3,
  name: 'YouTube 7TV Chat Emotes',
  description: 'Renders 7TV emotes in YouTube live chat, with autocomplete and an emote picker.',
  version: pkg.version,
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'YouTube 7TV Chat Emotes',
  },
  icons: {
    16: 'src/assets/icons/icon-16.png',
    32: 'src/assets/icons/icon-32.png',
    48: 'src/assets/icons/icon-48.png',
    128: 'src/assets/icons/icon-128.png',
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      // The chat iframe loads as its own document at this URL.
      // all_frames: true so we get injected inside the parent watch page's iframe.
      // https-only — refuse to run on the unencrypted variant even though
      // YouTube redirects http→https in practice.
      matches: ['https://www.youtube.com/live_chat*'],
      js: ['src/content/chat.ts'],
      run_at: 'document_end',
      all_frames: true,
    },
  ],
  permissions: ['storage'],
  host_permissions: ['https://7tv.io/*', 'https://cdn.7tv.app/*'],
});
