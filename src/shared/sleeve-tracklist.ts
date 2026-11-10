/**
 * <sleeve-tracklist>: the back of the sleeve. A helper element with no API of its own that sits inside the Tracks
 * sheet (a `<media-dialog>`) and prints the chapters as an ordered list of buttons: number, title, length. The
 * current chapter is the filled row with a heavy marker and the word NOW (and `aria-current`).
 *
 * Where the facts come from (Video.js v10, text tracks and time features, through a `PlayerController`):
 *  - `chaptersCues`: the cues of the chapters track (`MediaTextCue`: startTime, endTime, text), already clamped to the
 *    duration and refreshed by the player when the track or its cues change; the list is rebuilt when they do.
 *  - `currentTime`, `duration` and `seek(time)` from the time feature. A row press calls `seek(start)`, which leaves
 *    play and pause as they were, then closes the sheet so the picture shows where it landed.
 *
 * What it writes outside itself: `data-sleeve-chapters="<count>"` on the skin root while the media has chapters (and
 * removes it when it has none), which the CSS uses to show the Tracks opener cell and menu item. With no chapters
 * there is nothing to open, so the opener is not shown at all.
 *
 * The T key opens and closes the sheet. It is one `keydown` listener on this player's own root (so only while focus is
 * inside this player, the same reach as the hotkeys in the template, and never a page-wide listener). It ignores text
 * fields, modifier chords, repeats, and any moment another dialog of the player is open.
 */
import {
  PlayerController,
  type MediaTextCue,
  type PropertyValues,
  playerContext,
  selectTextTrack,
  selectTime,
  UIElement,
} from '@videojs/html';
import { anotherDialogOpen, findSheet, inTextField, listenForMenuOpener, type Sheet } from './sleeve-sheet';

const CHAPTERS_ATTRIBUTE = 'data-sleeve-chapters';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** 83 becomes 1:23, 3725 becomes 1:02:05. */
function formatLength(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;

  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`;
}

class SleeveTracklist extends UIElement {
  readonly #tracks = new PlayerController(this, playerContext, selectTextTrack);
  readonly #time = new PlayerController(this, playerContext, selectTime);

  #sheet: Sheet | null = null;
  #abort: AbortController | null = null;
  // What the rendered rows were made from, so a time update does not rebuild them.
  #signature = '';
  #rows: HTMLButtonElement[] = [];
  #starts: number[] = [];
  #current = -2;
  #opener: HTMLElement | null = null;

  override connectedCallback(): void {
    super.connectedCallback();

    this.#sheet = findSheet(this);

    if (!this.#sheet) return;

    this.#abort = new AbortController();

    const { signal } = this.#abort;
    const { root, dialog } = this.#sheet;

    listenForMenuOpener(this.#sheet, signal);
    root.addEventListener('keydown', this.#onKeydown, { signal });
    // The list follows the clock while it is closed too, so it is right the moment it opens. Focus goes to the row
    // that is playing, which is where a viewer who opened it most likely wants to start.
    dialog.addEventListener(
      'open-change-complete',
      (event) => {
        if ((event as CustomEvent<{ open: boolean }>).detail.open) {
          requestAnimationFrame(() => this.#focusCurrent());
          return;
        }

        const opener = this.#opener;

        this.#opener = null;
        requestAnimationFrame(() => {
          if (opener?.isConnected && !root.contains(document.activeElement)) opener.focus();
        });
      },
      { signal }
    );
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#abort?.abort();
    this.#abort = null;
    this.#sheet?.root.removeAttribute(CHAPTERS_ATTRIBUTE);
    this.#sheet = null;
  }

  protected override update(changed: PropertyValues): void {
    super.update(changed);

    const sheet = this.#sheet;

    if (!sheet) return;

    const cues: MediaTextCue[] = this.#tracks.value?.chaptersCues ?? [];
    const duration = this.#time.value?.duration ?? 0;
    const signature = `${duration}|${cues.map((cue) => `${cue.startTime}-${cue.endTime}-${cue.text}`).join('|')}`;

    if (signature !== this.#signature) {
      this.#signature = signature;
      this.#render(cues, duration);
    }

    this.#markCurrent(this.#time.value?.currentTime ?? 0);
  }

  #render(cues: MediaTextCue[], duration: number): void {
    const sheet = this.#sheet;

    if (!sheet) return;

    const hadFocus = this.contains(document.activeElement);
    const list = document.createElement('ol');

    list.className = 'sleeve-tracklist-list';
    // Safari drops the list role when list-style is none; saying it keeps the count and position announced.
    list.setAttribute('role', 'list');

    this.#rows = [];
    this.#starts = [];
    this.#current = -2;

    cues.forEach((cue, index) => {
      const end = Number.isFinite(cue.endTime) ? cue.endTime : (cues[index + 1]?.startTime ?? duration);
      const row = document.createElement('li');
      const button = document.createElement('button');
      const number = document.createElement('span');
      const title = document.createElement('span');
      const now = document.createElement('span');
      const length = document.createElement('span');
      const text = cue.text.trim();

      button.type = 'button';
      button.className = 'sleeve-track';
      // The visible title is cut to one line with an ellipsis; the full text stays in the name and the tooltip.
      button.title = text;
      button.addEventListener('click', () => this.#play(cue.startTime));

      number.className = 'sleeve-track-number';
      number.textContent = pad(index + 1);
      title.className = 'sleeve-track-title';
      title.textContent = text;
      // aria-current already says which row this is, so the printed word is for the eye only.
      now.className = 'sleeve-track-now';
      now.setAttribute('aria-hidden', 'true');
      now.textContent = 'NOW';
      length.className = 'sleeve-track-length';
      length.textContent = formatLength(end - cue.startTime);

      button.append(number, title, now, length);
      row.append(button);
      list.append(row);
      this.#rows.push(button);
      this.#starts.push(cue.startTime);
    });

    this.replaceChildren(list);

    const root = sheet.root;

    if (cues.length > 0) {
      root.setAttribute(CHAPTERS_ATTRIBUTE, String(cues.length));
    } else {
      root.removeAttribute(CHAPTERS_ATTRIBUTE);
      // Nothing left to show: a sheet that was open closes rather than turning into an empty page.
      sheet.dialog.open = false;
    }

    if (hadFocus) this.#focusCurrent();
  }

  /** The row for `time`: the last chapter that has started. A little slack, so a seek to a start lands on its own row. */
  #markCurrent(time: number): void {
    let current = -1;

    for (let index = 0; index < this.#starts.length; index++) {
      if (this.#starts[index]! <= time + 0.1) current = index;
    }

    if (current === this.#current) return;

    this.#current = current;

    this.#rows.forEach((button, index) => {
      if (index === current) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });
  }

  #play(start: number): void {
    // seek() sets the media's position and leaves it playing or paused as it was.
    void this.#time.value?.seek(start);
    this.#sheet!.dialog.open = false;
  }

  #focusCurrent(): void {
    const row = this.#rows[Math.max(this.#current, 0)];

    if (!row) return;

    row.focus({ preventScroll: true });
    row.scrollIntoView({ block: 'nearest' });
  }

  readonly #onKeydown = (event: KeyboardEvent): void => {
    const sheet = this.#sheet;

    if (!sheet || event.defaultPrevented || event.repeat) return;
    if (event.key !== 't' && event.key !== 'T') return;
    if (event.ctrlKey || event.altKey || event.metaKey || inTextField(event)) return;
    if (anotherDialogOpen(sheet)) return;

    const { dialog } = sheet;

    if (!dialog.open && !sheet.root.hasAttribute(CHAPTERS_ATTRIBUTE)) return;

    event.preventDefault();

    // The library returns focus to the element that has a `commandfor` for the dialog. When T opens it, that may be
    // another control, or none: remember where focus was and put it back on close if the library left it on the page.
    if (!dialog.open && document.activeElement instanceof HTMLElement) this.#opener = document.activeElement;

    dialog.open = !dialog.open;
  };
}

if (!customElements.get('sleeve-tracklist')) customElements.define('sleeve-tracklist', SleeveTracklist);
