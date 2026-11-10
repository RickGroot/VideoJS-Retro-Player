/**
 * <sleeve-keys>: the keyboard sheet's list. A helper element with no API of its own. Each time the Keys sheet opens it
 * reads this player's live `<media-hotkey>` elements (documented attributes `keys`, `action`, `value`, `disabled`),
 * skips the disabled ones, and prints what is left as key caps (real `<kbd>` elements) beside the action in words.
 * Reading the elements, not a copy of them, is what keeps the list true to the template: <sleeve-state> disables the
 * picture shortcuts in audio mode, and they simply are not listed then.
 *
 * T is not a `<media-hotkey>` (it is <sleeve-tracklist>'s own key), so it is added by hand while the media has chapters.
 *
 * Only `<media-hotkey>` elements inside this player's own root are read, so players on one page never mix.
 */
import { findSheet, listenForMenuOpener, type Sheet } from './sleeve-sheet';

interface Cap {
  /** What is printed on the cap. */
  face: string;
  /** The key's name in words, when the face is only a glyph. Read by screen readers instead of the glyph. */
  name?: string;
}

const KEY_FACES: Record<string, Cap> = {
  Space: { face: 'Space' },
  ArrowRight: { face: '→', name: 'Right arrow' },
  ArrowLeft: { face: '←', name: 'Left arrow' },
  ArrowUp: { face: '↑', name: 'Up arrow' },
  ArrowDown: { face: '↓', name: 'Down arrow' },
  '>': { face: '>', name: 'Greater than' },
  '<': { face: '<', name: 'Less than' },
  '+': { face: '+', name: 'Plus' },
};

/** `Shift+a` becomes two caps, `0-9` one (a range of digits), `ArrowUp` one with a glyph. */
function capsFor(pattern: string): Cap[] {
  if (/^\d-\d$/.test(pattern)) return [{ face: pattern.replace('-', '–') }];

  const parts = pattern === '+' ? ['+'] : pattern.split('+');

  return parts.map((part) => KEY_FACES[part] ?? { face: part.length === 1 ? part.toUpperCase() : part });
}

/** The action in words, from the hotkey's own `action` and `value` (and the key, for the volume pair). */
function describe(action: string, value: number | undefined, keys: string): string | null {
  switch (action) {
    case 'togglePaused':
      return 'Play / pause';
    case 'toggleMuted':
      return 'Mute';
    case 'toggleFullscreen':
      return 'Fullscreen';
    case 'toggleSubtitles':
      return 'Captions';
    case 'togglePictureInPicture':
      return 'Picture in picture';
    case 'seekStep':
      return value !== undefined && value < 0 ? `Back ${Math.abs(value)} s` : `Forward ${value ?? 10} s`;
    case 'volumeStep':
      return value !== undefined ? (value < 0 ? 'Volume down' : 'Volume up') : keys === 'ArrowDown' ? 'Volume down' : 'Volume up';
    case 'seekToPercent':
      if (value === 0) return 'Start';
      if (value === 100) return 'End';
      return 'Jump to 0–90 %';
    case 'speedUp':
      return 'Faster';
    case 'speedDown':
      return 'Slower';
    default:
      return null;
  }
}

class SleeveKeys extends HTMLElement {
  #sheet: Sheet | null = null;
  #abort: AbortController | null = null;

  connectedCallback(): void {
    this.#sheet = findSheet(this);

    if (!this.#sheet) return;

    // A list that scrolls must be reachable by keyboard: it takes focus like any scroll region.
    this.tabIndex = 0;
    this.setAttribute('role', 'group');
    this.setAttribute('aria-label', 'Keyboard shortcuts');
    this.#abort = new AbortController();

    const { signal } = this.#abort;

    listenForMenuOpener(this.#sheet, signal);
    // Read the live elements each time the sheet opens, so what it says is what the player does right now.
    this.#sheet.dialog.addEventListener(
      'open-change',
      (event) => {
        if ((event as CustomEvent<{ open: boolean }>).detail.open) this.#render();
      },
      { signal }
    );
    this.#render();
  }

  disconnectedCallback(): void {
    this.#abort?.abort();
    this.#abort = null;
    this.#sheet = null;
  }

  #render(): void {
    const sheet = this.#sheet;

    if (!sheet) return;

    // One line per action: Space and K both play and pause, so they share a line.
    const lines = new Map<string, Cap[][]>();

    for (const hotkey of sheet.root.querySelectorAll('media-hotkey')) {
      if (hotkey.hasAttribute('disabled') || (hotkey as HTMLElement & { disabled?: boolean }).disabled) continue;

      const keys = hotkey.getAttribute('keys') ?? '';
      const action = hotkey.getAttribute('action') ?? '';
      const raw = hotkey.getAttribute('value');
      const label = keys && describe(action, raw === null ? undefined : Number(raw), keys);

      if (!label) continue;

      lines.set(label, [...(lines.get(label) ?? []), capsFor(keys)]);
    }

    if (sheet.root.hasAttribute('data-sleeve-chapters')) lines.set('Tracks', [capsFor('t')]);

    const list = document.createElement('ul');

    list.className = 'sleeve-keys-list';
    list.setAttribute('role', 'list');

    for (const [label, combos] of lines) {
      const item = document.createElement('li');
      const group = document.createElement('span');
      const action = document.createElement('span');

      group.className = 'sleeve-keys-caps';
      action.className = 'sleeve-keys-action';
      action.textContent = label;

      combos.forEach((combo, index) => {
        // An alternative key: the caps of the first and the second are told apart by a word, not only by space.
        if (index > 0) group.append(this.#word('or'));

        combo.forEach((cap, position) => {
          if (position > 0) group.append(this.#word('+'));

          group.append(this.#cap(cap));
        });
      });

      item.append(group, action);
      list.append(item);
    }

    this.replaceChildren(list);
  }

  #word(text: string): HTMLElement {
    const span = document.createElement('span');

    span.className = 'sleeve-keys-join';
    span.textContent = text;

    return span;
  }

  #cap({ face, name }: Cap): HTMLElement {
    const kbd = document.createElement('kbd');

    kbd.className = 'sleeve-keycap';

    if (face.length > 1 && !name) kbd.dataset.wide = '';

    if (name) {
      const glyph = document.createElement('span');
      const words = document.createElement('span');

      glyph.setAttribute('aria-hidden', 'true');
      glyph.textContent = face;
      words.className = 'sleeve-sheet-sr';
      words.textContent = name;
      kbd.append(glyph, words);
    } else {
      kbd.textContent = face;
    }

    return kbd;
  }
}

if (!customElements.get('sleeve-keys')) customElements.define('sleeve-keys', SleeveKeys);
