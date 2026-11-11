import '@/video/player';
import '@videojs/html/audio/player';
import '@videojs/html/media/mux-video';
import '@videojs/html/media/mux-audio';
import '@videojs/html/i18n';
// The picker's languages, registered up front so a switch does not flash English while a pack loads.
import '@videojs/html/i18n/locales/de/register';
import '@videojs/html/i18n/locales/ja/register';
import '@videojs/html/i18n/locales/ar/register';
import '@/video/skin';
import '@/audio/skin';
import videoTemplate from '@/video/skin.html?raw';
import audioTemplate from '@/audio/skin.html?raw';
import { uniqueIds } from '@/shared/unique-ids';
import designNote from './design-note.html?raw';
import './demo.css';
import { initTour } from './tour';
import { initOwn } from './own';
import {
  AUDIO_LONG_TITLE,
  AUDIO_POSTER,
  AUDIO_SRC,
  AUDIO_TITLE,
  BROKEN_SRC,
  CHAPTERS,
  VIDEO_POSTER,
  VIDEO_SKIP_INTRO,
  VIDEO_SRC,
} from './media';

const MEDIA_PLACEHOLDER = '<!-- Add a compatible media component here. -->';
const FIXED_FIELD_FALLBACK = '#3d5afe';

type Kind = 'video' | 'audio' | 'audio-mode';

interface PlayerSpec {
  /** Unique per player, becomes the id suffix. */
  n: number;
  kind: Kind;
  /** Only the first player of a page opens its stream on load. */
  preload: boolean;
  title?: string;
  artwork?: boolean;
  /** A visitor's own media (from PLAY YOUR OWN) in place of the demo clip, its poster, chapters and intro window. */
  media?: HTMLElement;
  /** Pin the skin's look (`data-mode`): a visitor's iframe player reports no picture size, so it is pinned to video. */
  mode?: 'video';
}

const wrappers: HTMLElement[] = [];
const mounted = new Map<string, { wrapper: HTMLElement; spec: PlayerSpec }>();

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);

  if (className) node.className = className;

  return node;
}

/** Build one player, as `frame/player.ts` and `frame/audio-player.ts` do. */
function createPlayer(spec: PlayerSpec): HTMLElement {
  const suffix = String(spec.n);
  const isVideo = spec.kind === 'video';
  const player = document.createElement(isVideo || spec.kind === 'audio-mode' ? 'sleeve-player' : 'audio-player');
  const template = uniqueIds(isVideo || spec.kind === 'audio-mode' ? videoTemplate : audioTemplate, suffix);
  const preload = spec.preload ? '' : ' preload="none"';
  const track = `<track kind="chapters" label="English" srclang="en" src="${CHAPTERS}" default>`;
  const own = isVideo ? spec.media : undefined;
  const media = own
    ? '<span data-own-slot></span>'
    : isVideo
    ? `<mux-video src="${VIDEO_SRC}" playsinline crossorigin${preload}>${track}</mux-video>`
    : `<mux-audio src="${AUDIO_SRC}" crossorigin${preload}>${track}</mux-audio>`;

  // Only constants go through innerHTML. A visitor's media is an element made with createElement.
  player.innerHTML = template.replace(MEDIA_PLACEHOLDER, media);

  if (own) {
    player.querySelector('[data-own-slot]')?.replaceWith(own);
    // No poster and no intro window: the demo clip's own details stay with the demo clip.
  } else if (isVideo) {
    player.setAttribute('poster', VIDEO_POSTER);
    player.querySelector('.media-skin')?.setAttribute('data-sleeve-skip-intro', VIDEO_SKIP_INTRO);
  } else {
    player.setAttribute('poster', spec.artwork === false ? '' : AUDIO_POSTER);
    // Empty on purpose when absent, so the stream's own metadata title is not used.
    player.setAttribute('content-title', spec.title ?? AUDIO_TITLE);
  }

  if (spec.kind === 'audio-mode') player.querySelector('.media-skin')?.setAttribute('data-mode', 'audio');
  // The documented pin (README, "audio look"): data-mode="video" keeps the video look. Rebuilt with every player, so Reset drops it.
  else if (spec.mode) player.querySelector('.media-skin')?.setAttribute('data-mode', spec.mode);

  return player;
}

/** The language the players speak. Set on each provider, so the page's own English text keeps `lang="en"`. */
let playerLanguage = 'en';

/** The picker's right-to-left languages. */
const RIGHT_TO_LEFT = new Set(['ar']);

/**
 * Give a provider the players' language and its direction. `lang` alone leaves the CSS direction at ltr (checked in
 * Chromium), and the skin mirrors on the CSS direction, so `dir` is set too.
 */
function speak(i18n: Element): void {
  i18n.setAttribute('lang', playerLanguage);
  i18n.setAttribute('dir', RIGHT_TO_LEFT.has(playerLanguage) ? 'rtl' : 'ltr');
}

/** Put a player on the page inside its own i18n provider. */
function mount(id: string, host: HTMLElement | undefined, spec: PlayerSpec): HTMLElement {
  const wrapper = element('div', 'demo-player');
  const i18n = document.createElement('media-i18n');

  speak(i18n);
  i18n.append(createPlayer(spec));
  wrapper.append(i18n);
  host?.append(wrapper);
  wrappers.push(wrapper);
  mounted.set(id, { wrapper, spec });

  return wrapper;
}

function remount(id: string): void {
  const entry = mounted.get(id);
  const i18n = entry?.wrapper.querySelector('media-i18n');

  if (!entry || !i18n) return;

  i18n.replaceChildren(createPlayer(entry.spec));
}

/** Point the player's media at a source that fails, which opens the skin's error panel. */
function breakPlayer(id: string): void {
  const media = mounted.get(id)?.wrapper.querySelector(
    'mux-video, mux-audio, shaka-video, cloudflare-video, youtube-video, vimeo-video, video, audio',
  );

  media?.setAttribute('src', BROKEN_SRC);
  (media as HTMLMediaElement | null)?.load?.();
}

/** Put the demo clip back: drops a visitor's source, and with it the visitor's field and message. */
function resetToDemo(): void {
  const entry = mounted.get('video');

  if (entry) entry.spec = { ...entry.spec, media: undefined, mode: undefined };

  remount('video');
  own.cleared();
}

function figure(caption: string, wrapper: HTMLElement): HTMLElement {
  const fig = element('figure', 'case');
  const text = element('figcaption');

  text.textContent = caption;
  fig.append(wrapper, text);

  return fig;
}

// Players. Only the first player loads its stream; the rest wait for a press of play.
const videoStage = document.getElementById('video-stage');
const audioGrid = document.getElementById('audio-grid');

if (!videoStage || !audioGrid) throw new Error('The demo page is missing its player stages.');

const videoWrapper = mount('video', videoStage, { n: 1, kind: 'video', preload: true });

const audioCases: Array<{ id: string; caption: string; spec: PlayerSpec; width?: number }> = [
  { id: 'audio', caption: 'The audio skin, with artwork and a title.', spec: { n: 2, kind: 'audio', preload: false } },
  {
    id: 'audio-long',
    caption: 'No artwork, and a title that runs on.',
    spec: { n: 3, kind: 'audio', preload: false, artwork: false, title: AUDIO_LONG_TITLE },
  },
  {
    id: 'audio-narrow',
    caption: 'The audio skin at 320 pixels wide.',
    spec: { n: 4, kind: 'audio', preload: false },
    width: 320,
  },
  {
    id: 'audio-mode',
    caption: 'The video skin in audio mode, fed the same audio.',
    spec: { n: 5, kind: 'audio-mode', preload: false },
  },
];

for (const item of audioCases) {
  const wrapper = mount(item.id, undefined, item.spec);

  if (item.width) wrapper.style.maxWidth = `${item.width}px`;

  audioGrid.append(figure(item.caption, wrapper));
}

// Page controls.
function radioValue(name: string): string {
  return document.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value ?? '';
}

const root = document.documentElement;
const colour = document.getElementById('field-colour') as HTMLInputElement;

function applyScheme(): void {
  const scheme = radioValue('scheme');

  root.style.colorScheme = scheme === 'light' ? 'light' : scheme === 'dark' ? 'dark' : 'light dark';
}

function applyField(): void {
  const fixed = radioValue('field') === 'fixed';
  const value = colour.value || FIXED_FIELD_FALLBACK;

  colour.disabled = !fixed;

  for (const wrapper of wrappers) {
    if (fixed) wrapper.style.setProperty('--media-accent-color', value);
    else wrapper.style.removeProperty('--media-accent-color');
  }

  if (fixed) root.style.setProperty('--demo-field', value);
  else root.style.removeProperty('--demo-field');

  // Without CSS contrast-color(), pick the ink from the luminance of the chosen colour.
  if (CSS.supports('color', 'contrast-color(red)')) return;

  const channels = [1, 3, 5].map((at) => parseInt(value.slice(at, at + 2), 16) / 255);
  const light = 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]! > 0.5;

  const ink = light ? '#0e0e0f' : '#ffffff';

  if (fixed) root.style.setProperty('--on-field', ink);
  else root.style.removeProperty('--on-field');

  // The skins read --sleeve-on-accent for the text on a pinned field.
  for (const wrapper of wrappers) {
    if (fixed) wrapper.style.setProperty('--sleeve-on-accent', ink);
    else wrapper.style.removeProperty('--sleeve-on-accent');
  }
}

function applySize(): void {
  videoWrapper.style.maxWidth = `${radioValue('size')}px`;
}

document.querySelector('[data-control="scheme"]')?.addEventListener('change', applyScheme);
document.querySelector('[data-control="field"]')?.addEventListener('change', applyField);
colour.addEventListener('input', applyField);
document.querySelector('[data-control="size"]')?.addEventListener('change', applySize);

// The providers follow a change of their `lang` without a remount.
const language = document.getElementById('player-language') as HTMLSelectElement;

language.addEventListener('change', () => {
  playerLanguage = language.value;

  for (const { wrapper } of mounted.values()) {
    const i18n = wrapper.querySelector('media-i18n');

    if (i18n) speak(i18n);
  }
});

document.addEventListener('click', (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>('button[data-action]');

  if (!button) return;

  const ids = [...mounted.keys()].filter((id) => (button.dataset.slot === 'audio' ? id.startsWith('audio') : id === 'video'));

  for (const id of ids) {
    if (button.dataset.action === 'break') breakPlayer(id);
    else if (id === 'video') resetToDemo();
    else remount(id);
  }
});

applyScheme();
applyField();
applySize();

const own = initOwn({
  wrapper: videoWrapper,
  reset: resetToDemo,
  play(media, options) {
    const entry = mounted.get('video');

    if (entry) entry.spec = { ...entry.spec, media, mode: options?.video ? 'video' : undefined };

    remount('video');
  },
});

initTour({ wrapper: videoWrapper, reset: () => remount('video'), breakIt: () => breakPlayer('video') });

// Keyboard table, read from the skins' own `media-hotkey` elements.
function keyLabel(key: string): string {
  const names: Record<string, string> = {
    ArrowRight: '→',
    ArrowLeft: '←',
    ArrowUp: '↑',
    ArrowDown: '↓',
    Space: 'Space',
    '0-9': '0 to 9',
  };

  return names[key] ?? (key.length === 1 && /[a-z]/.test(key) ? key.toUpperCase() : key);
}

function actionLabel(action: string, key: string, value: string | null): string {
  const amount = Number(value);

  switch (action) {
    case 'togglePaused':
      return 'Play or pause';
    case 'toggleMuted':
      return 'Mute or unmute';
    case 'seekStep':
      return `Seek ${amount < 0 ? 'back' : 'forward'} ${Math.abs(amount) || 10} seconds`;
    case 'volumeStep':
      return key === 'ArrowDown' ? 'Volume down' : 'Volume up';
    case 'seekToPercent':
      if (value === null) return 'Jump to a position by number';
      return amount === 0 ? 'Jump to the start' : amount === 100 ? 'Jump to the end' : `Jump to ${amount} percent`;
    case 'speedUp':
      return 'Faster';
    case 'speedDown':
      return 'Slower';
    case 'toggleFullscreen':
      return 'Fullscreen';
    case 'toggleSubtitles':
      return 'Captions';
    case 'togglePictureInPicture':
      return 'Picture in picture';
    default:
      return action;
  }
}

function readHotkeys(template: string): Array<{ label: string; key: string }> {
  const doc = new DOMParser().parseFromString(template, 'text/html');

  return [...doc.querySelectorAll('media-hotkey')].map((node) => {
    const key = node.getAttribute('keys') ?? '';

    return { label: actionLabel(node.getAttribute('action') ?? '', key, node.getAttribute('value')), key };
  });
}

function renderKeys(): void {
  const body = document.getElementById('keys-body');

  if (!body) return;

  const rows = new Map<string, { keys: string[]; video: boolean; audio: boolean }>();
  const add = (list: Array<{ label: string; key: string }>, where: 'video' | 'audio') => {
    for (const { label, key } of list) {
      const row = rows.get(label) ?? { keys: [], video: false, audio: false };

      if (!row.keys.includes(key)) row.keys.push(key);

      row[where] = true;
      rows.set(label, row);
    }
  };

  add(readHotkeys(videoTemplate), 'video');
  add(readHotkeys(audioTemplate), 'audio');

  for (const [label, row] of rows) {
    const tr = element('tr');
    const action = element('th');
    const keys = element('td');
    const where = element('td');

    action.scope = 'row';
    action.textContent = label;

    for (const key of row.keys) {
      const kbd = element('kbd');

      kbd.textContent = keyLabel(key);
      keys.append(kbd, ' ');
    }

    where.textContent = row.video && row.audio ? 'Video and audio' : row.video ? 'Video' : 'Audio';
    tr.append(action, keys, where);
    body.append(tr);
  }
}

renderKeys();

const note = document.getElementById('design-note');

if (note) note.innerHTML = designNote;
