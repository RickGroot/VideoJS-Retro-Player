/**
 * <sleeve-reach>: a helper element with no box and no API of its own. It writes two attributes for the video skin's
 * CSS on the skin root (`.media-skin`), `data-sleeve-reach` and `data-sleeve-pointer`, and reads nothing from the
 * player.
 *
 * `data-sleeve-reach`: while the media plays, a mouse user sees the Line (the slider row alone) and the full strip (the Block) opens when
 * the pointer comes for it. CSS `:hover` cannot say that without moving things from under the pointer: the Block's
 * slider row sits higher than the Line's, so a hover that opens the Block takes the slider away from the pointer that
 * is on it, and a strip that closes the moment the pointer leaves flaps at its edge. So the attribute is a latch:
 *
 *   - set when a mouse pointer is in the strip while the full strip shows, or comes to the strip anywhere but the
 *     Line's own slider row and play cell (the band above the Line, in practice);
 *   - kept for as long as the pointer stays in the strip, and while a mouse button is held (a drag);
 *   - dropped a short moment after the pointer has left the strip or the player, and not if it comes back in time.
 *
 * The CSS also keeps the strip up while the attribute is set, so the strip does not hide under a pointer that rests on
 * one of its cells when Video.js's idle time runs out.
 *
 * Touch and pen never set it: the Line is for mouse pointers only.
 *
 * `data-sleeve-pointer`: the last input in the player was a pointer press, not the Tab key. A cell that was clicked
 * keeps focus, and the first key press after that (a hotkey, say) makes the browser match `:focus-visible` on it. The
 * CSS keeps the strip up for keyboard focus, so without this attribute one click followed by a hotkey would hold the
 * strip up for good. Set on any pointer press in the player, dropped on Tab. Without the helper the attribute is
 * never set and every visible focus counts, which is the safe side.
 *
 * The skin's CSS hides this element.
 */
const ROOT_SELECTOR = '.media-skin';
const STRIP_SELECTOR = '.sleeve-strip';
const CELLS_SELECTOR = '.sleeve-cells';
const CONTROLS_SELECTOR = 'media-controls';
/** The parts of the strip the Line shows. A pointer on them leaves the Line as it is. */
const LINE_SELECTOR = '.sleeve-slider-row, .sleeve-play-cell';
const ATTRIBUTE = 'data-sleeve-reach';
const POINTER_ATTRIBUTE = 'data-sleeve-pointer';
/** How long the full strip outlives the pointer, in milliseconds. */
const GRACE = 300;
const CAPTURE = { capture: true, passive: true } as const;

class SleeveReach extends HTMLElement {
  #root: HTMLElement | null = null;
  #timer: ReturnType<typeof setTimeout> | undefined;

  connectedCallback(): void {
    this.#root = this.closest<HTMLElement>(ROOT_SELECTOR);

    const root = this.#root;
    if (!root) return;

    // Capture: the move that wakes the controls has to be read before Video.js shows them (see #inside).
    root.addEventListener('pointermove', this.#onPointer, CAPTURE);
    root.addEventListener('pointerdown', this.#onPointer, CAPTURE);
    root.addEventListener('pointerup', this.#onPointer, CAPTURE);
    // Not captured: a captured pointerleave would also fire for every element inside the player.
    root.addEventListener('pointerleave', this.#onLeave, { passive: true });
    // Tab can arrive from outside the player (the page, the browser's own UI), so it is heard on the document.
    document.addEventListener('keydown', this.#onKey, CAPTURE);
  }

  disconnectedCallback(): void {
    const root = this.#root;

    this.#cancel();
    document.removeEventListener('keydown', this.#onKey, CAPTURE);
    if (!root) return;

    root.removeEventListener('pointermove', this.#onPointer, CAPTURE);
    root.removeEventListener('pointerdown', this.#onPointer, CAPTURE);
    root.removeEventListener('pointerup', this.#onPointer, CAPTURE);
    root.removeEventListener('pointerleave', this.#onLeave);
    root.removeAttribute(ATTRIBUTE);
    root.removeAttribute(POINTER_ATTRIBUTE);
    this.#root = null;
  }

  readonly #onPointer = (event: PointerEvent): void => {
    const root = this.#root;
    if (!root) return;

    if (event.type === 'pointerdown') root.setAttribute(POINTER_ATTRIBUTE, '');
    if (event.pointerType !== 'mouse') return;

    const strip = root.querySelector<HTMLElement>(STRIP_SELECTOR);
    const target = event.target instanceof Element ? event.target : null;
    if (!strip || !target) return;

    // Read before Video.js answers this same event: a move over hidden controls is the one that wakes them.
    const hidden = !root.querySelector(CONTROLS_SELECTOR)?.hasAttribute('data-visible');

    if (!this.#inside(strip, target, event, hidden)) {
      // A held button is a drag that began in the strip (the time or volume slider): the strip stays as it is.
      if (event.buttons !== 0) return;

      // Waking away from the strip: a latch left over from before the controls hid goes at once, not after the grace.
      if (hidden) this.#drop();
      else this.#release();
      return;
    }

    this.#cancel();
    if (root.hasAttribute(ATTRIBUTE)) return;

    // On the Line's own parts the Line stays, so the slider does not move away from the pointer that is on it.
    const full = (strip.querySelector<HTMLElement>(CELLS_SELECTOR)?.offsetHeight ?? 0) > 0;
    if (full || !target.closest(LINE_SELECTOR)) root.setAttribute(ATTRIBUTE, '');
  };

  readonly #onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Tab') this.#root?.removeAttribute(POINTER_ATTRIBUTE);
  };

  readonly #onLeave = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse') this.#release();
  };

  /**
   * Whether the pointer is in the strip. A hidden strip takes no pointer events, so the first move that wakes the
   * controls lands on the picture behind it: while the controls are hidden, the strip's box answers instead.
   */
  #inside(strip: HTMLElement, target: Element, event: PointerEvent, hidden: boolean): boolean {
    if (strip.contains(target)) return true;
    if (!hidden) return false;

    const box = strip.getBoundingClientRect();
    return (
      event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom
    );
  }

  #release(): void {
    const root = this.#root;
    if (!root?.hasAttribute(ATTRIBUTE) || this.#timer !== undefined) return;

    this.#timer = setTimeout(() => this.#drop(), GRACE);
  }

  #drop(): void {
    this.#cancel();
    this.#root?.removeAttribute(ATTRIBUTE);
  }

  #cancel(): void {
    if (this.#timer === undefined) return;

    clearTimeout(this.#timer);
    this.#timer = undefined;
  }
}

if (!customElements.get('sleeve-reach')) customElements.define('sleeve-reach', SleeveReach);
