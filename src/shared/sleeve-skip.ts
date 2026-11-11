/**
 * <sleeve-skip>: a helper element with no box and no API of its own. It is a Video.js custom element (a `UIElement`
 * with a `PlayerController`, as `sleeve-state.ts` is). The host page says where a skippable part of the media is, as
 * attributes on the skin root (`.media-skin`), in seconds, decimals allowed:
 *
 *   data-sleeve-skip-intro="1-12"      an intro from 1 s to 12 s
 *   data-sleeve-skip-credits="95-"     credits from 95 s; with no end they run to the end of the media
 *
 * While the playhead is inside such a window (start included, end excluded) and the media is not live, the helper
 * shows the skin's `.sleeve-skip` pill, which is a `<media-seek-button>`: the pill is the button, Video.js's own element
 * does the seek. The helper only sets that element's documented `seconds` and `label` and its `hidden` attribute,
 * so a press moves the playhead from where it is to the end of the window, and the window is behind it. It never seeks.
 *
 * It writes `data-sleeve-skip="intro|credits"` on the root while the pill shows. When the pill hides while it holds
 * focus (after a press), focus moves to the play button, so it never falls back to the page.
 *
 * Time comes from Video.js's time state. The skin's CSS hides this element.
 */
import { PlayerController, type PropertyValues, playerContext, selectTime, UIElement } from '@videojs/html';

const ROOT_SELECTOR = '.media-skin';
const BUTTON_SELECTOR = '.sleeve-skip';
const TEXT_SELECTOR = '.sleeve-skip-text';
const ATTRIBUTES = ['data-sleeve-skip-intro', 'data-sleeve-skip-credits'];

type Kind = 'intro' | 'credits';
type Window = { kind: Kind; start: number; end: number };

const LABELS: Record<Kind, string> = { intro: 'Skip intro', credits: 'Skip credits' };

/** "1-12" or "95-" as seconds. Anything that is not finite, negative or empty gives null (no window). */
function parse(kind: Kind, value: string | null, duration: number): Window | null {
  if (!value) return null;

  const [from, to = ''] = value.split('-');
  const start = Number.parseFloat(from ?? '');
  const end = to.trim() === '' ? (kind === 'credits' ? duration : Number.NaN) : Number.parseFloat(to);

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) return null;

  return { kind, start, end };
}

class SleeveSkip extends UIElement {
  readonly #time = new PlayerController(this, playerContext, selectTime);

  #root: HTMLElement | null = null;
  #observer: MutationObserver | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    this.#root = this.closest<HTMLElement>(ROOT_SELECTOR);

    if (!this.#root) return;

    // The host may change the windows at any time (a new source).
    this.#observer = new MutationObserver(() => this.requestUpdate());
    this.#observer.observe(this.#root, {
      attributes: true,
      attributeFilter: [...ATTRIBUTES, 'data-live'],
    });
    this.requestUpdate();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#observer?.disconnect();
    this.#observer = null;
    this.#root?.removeAttribute('data-sleeve-skip');
    this.#root = null;
  }

  protected override update(changed: PropertyValues): void {
    super.update(changed);

    const root = this.#root;
    const button = root?.querySelector<HTMLElement & { label?: string }>(BUTTON_SELECTOR);

    if (!root || !button) return;

    const { currentTime = 0, duration = 0 } = this.#time.value ?? {};
    const cue = root.hasAttribute('data-live') || !(duration > 0) ? null : this.#active(root, currentTime, duration);

    if (cue) {
      // The seek is relative, so the distance to the end of the window is refreshed with every time update.
      const seconds = Math.max(0.1, cue.end - currentTime).toFixed(1);
      const label = LABELS[cue.kind];
      const text = button.querySelector<HTMLElement>(TEXT_SELECTOR);

      if (button.getAttribute('seconds') !== seconds) button.setAttribute('seconds', seconds);
      if (button.getAttribute('label') !== label) button.setAttribute('label', label);
      if (text && text.textContent !== label.toUpperCase()) text.textContent = label.toUpperCase();
      if (button.hidden) button.hidden = false;
      if (root.getAttribute('data-sleeve-skip') !== cue.kind) root.setAttribute('data-sleeve-skip', cue.kind);

      return;
    }

    if (!button.hidden) {
      // A pressed pill has focus; hand it to the play button before it goes.
      if (button.contains(document.activeElement)) root.querySelector<HTMLElement>('media-play-button')?.focus();

      button.hidden = true;
    }

    root.removeAttribute('data-sleeve-skip');
  }

  #active(root: HTMLElement, time: number, duration: number): Window | null {
    const windows = [
      parse('intro', root.getAttribute('data-sleeve-skip-intro'), duration),
      parse('credits', root.getAttribute('data-sleeve-skip-credits'), duration),
    ];

    return windows.find((window) => window && time >= window.start && time < window.end) ?? null;
  }
}

if (!customElements.get('sleeve-skip')) customElements.define('sleeve-skip', SleeveSkip);
