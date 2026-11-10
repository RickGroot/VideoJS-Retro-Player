import './tour.css';

/**
 * The five-state tour of the demo page. Page code, not skin code: it drives the demo's video player through the media
 * element (play, pause, currentTime, a source that cannot load), the way the "Break it" button already does, and reads
 * the skin's own `data-open` on its error dialog to know the error has shown.
 *
 * Nothing here is a player API of Sleeve's own. The tour is one panel with one running state, tied to the one player
 * the page hands it.
 */

interface Host {
  /** The wrapper `mount()` made for the player. Its media is found again at every step, because a reset replaces it. */
  wrapper: HTMLElement;
  /** Replace the player with a fresh one: original source, start position, paused, Ready, no dialog. */
  reset: () => void;
  /** Point the media at a source that fails. */
  breakIt: () => void;
}

interface Step {
  state: string;
  name: string;
  /** How long the state is held once it has been reached, in milliseconds. */
  hold: number;
  /** One printed line: why the field has this size and colour. Each claim was checked on screen. */
  caption: string;
}

const STEPS: Step[] = [
  {
    state: 'ready',
    name: 'Ready',
    hold: 2500,
    caption: 'The orange cover is printed on the picture, because nothing has played yet.',
  },
  {
    state: 'playing',
    name: 'Playing',
    hold: 4500,
    caption: 'Yellow field. The controls step away and the field shrinks to a thin line on the bottom edge.',
  },
  {
    state: 'paused',
    name: 'Paused',
    hold: 2500,
    caption: 'Blue field. The play button and the time flood blue, so a pause is never mistaken for play.',
  },
  {
    state: 'ended',
    name: 'Ended',
    hold: 2500,
    caption: 'Green cover. It returns when the end is reached, and the play button turns into restart.',
  },
  {
    state: 'error',
    name: 'Error',
    hold: 2500,
    caption: 'Red field. Playback failed, so a dialog names the problem and can be dismissed.',
  },
];

const IDLE_CAPTION = 'Five states, five colours, each a hard cut. Play the tour to watch the player change.';
const FAILED_CAPTION = 'The video could not be played, so the tour stopped. Check the connection and try again.';

type Media = HTMLMediaElement;

/** Resolve after `ms`, or as soon as the signal aborts. The caller checks `signal.aborted`. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);

    signal.addEventListener('abort', done);
  });
}

/** Resolve true when `test` holds (checked on the events and every 100 ms), false after `ms` or on abort. */
function until(test: () => boolean, target: EventTarget | null, events: string[], ms: number, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    const finish = (value: boolean) => {
      clearTimeout(timeout);
      clearInterval(poll);
      signal.removeEventListener('abort', onAbort);
      for (const name of events) target?.removeEventListener(name, check);

      resolve(value);
    };
    const check = () => {
      if (test()) finish(true);
    };
    const onAbort = () => finish(false);
    const timeout = setTimeout(() => finish(false), ms);
    const poll = setInterval(check, 100);

    for (const name of events) target?.addEventListener(name, check);

    signal.addEventListener('abort', onAbort);
    check();
  });
}

export function initTour(host: Host): void {
  const panel = document.getElementById('tour');
  const start = document.getElementById('tour-start') as HTMLButtonElement | null;
  const stop = document.getElementById('tour-stop') as HTMLButtonElement | null;
  const caption = document.getElementById('tour-caption');
  const live = document.getElementById('tour-live');
  const section = panel?.closest('section');
  const items = [...(panel?.querySelectorAll<HTMLElement>('.tour-steps > li') ?? [])];

  if (!panel || !start || !stop || !caption || !live || !section || items.length !== STEPS.length) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const videoButtons = document.querySelectorAll<HTMLButtonElement>('button[data-slot="video"]');

  let running = false;
  let abort: AbortController | null = null;
  // Reduced motion: the step the player is on, and whether a step is still being entered.
  let stepIndex = -1;
  let busy = false;
  let previous = { muted: false, volume: 1 };

  const media = (): Media | null => host.wrapper.querySelector<Media>('mux-video');

  function show(index: number): void {
    const step = STEPS[index];

    items.forEach((item, at) => {
      if (at === index) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });

    if (step) {
      panel!.dataset.state = step.state;
      caption!.textContent = `${step.name}. ${step.caption}`;
      // One announcement per step, said when the step starts.
      live!.textContent = `Step ${index + 1} of ${STEPS.length}: ${step.name}`;
    }
  }

  function labelStart(): void {
    if (!reduceMotion.matches) start!.textContent = 'Play the tour';
    else if (stepIndex < 0) start!.textContent = 'Next state';
    else start!.textContent = stepIndex === STEPS.length - 1 ? 'Put the player back' : 'Next state';
  }

  function setRunning(value: boolean): void {
    const hadFocus = panel!.contains(document.activeElement);

    running = value;
    panel!.toggleAttribute('data-running', value);
    // A running tour owns the player: no stray clicks, no second source of state.
    host.wrapper.inert = value;

    for (const button of videoButtons) button.disabled = value;

    // Stepping by hand keeps its button; the timed tour swaps Play for Stop.
    start!.hidden = value && !reduceMotion.matches;
    stop!.hidden = !value;

    if (hadFocus) (value ? (start!.hidden ? stop! : start!) : start!).focus();
  }

  /** Put the player back as it was before the tour: a fresh one, with the sound setting the viewer had. */
  function restore(message: string, text: string): void {
    abort?.abort();
    abort = null;
    stepIndex = -1;
    busy = false;
    host.reset();

    const next = media();

    if (next) {
      next.muted = previous.muted;
      next.volume = previous.volume;
    }

    setRunning(false);
    show(-1);
    delete panel!.dataset.state;
    caption!.textContent = text;
    live!.textContent = message;
    labelStart();
  }

  function bringIntoView(): void {
    const stage = host.wrapper.getBoundingClientRect();
    const top = panel!.getBoundingClientRect().top;

    if (top < 0 || stage.bottom > window.innerHeight) panel!.scrollIntoView({ block: 'start', behavior: 'auto' });
  }

  /** Begin: a fresh player, muted. Returns false when there is no media to drive. */
  function begin(): boolean {
    const current = media();

    if (!current) return false;

    previous = { muted: current.muted, volume: current.volume };
    host.reset();

    const fresh = media();

    if (!fresh) return false;

    fresh.muted = true;
    setRunning(true);
    bringIntoView();

    return true;
  }

  /** Make the player reach one state. Returns false when it did not get there in time. */
  async function enter(index: number, signal: AbortSignal): Promise<boolean> {
    const el = media();

    if (!el) return false;

    el.muted = true;

    switch (STEPS[index]?.state) {
      case 'ready':
        return true;
      case 'playing':
        await el.play().catch(() => undefined);
        return until(() => !el.paused && el.readyState >= 3 && el.currentTime > 0, el, ['playing', 'timeupdate'], 12000, signal);
      case 'paused':
        el.pause();
        return until(() => el.paused, el, ['pause'], 2000, signal);
      case 'ended': {
        // A little before the end, so the end comes in a moment.
        if (Number.isFinite(el.duration)) el.currentTime = Math.max(0, el.duration - 0.8);

        await el.play().catch(() => undefined);
        return until(() => el.ended, el, ['ended'], 12000, signal);
      }
      default:
        host.breakIt();
        return until(() => Boolean(host.wrapper.querySelector('media-dialog-popup[data-open]')), el, ['error'], 10000, signal);
    }
  }

  async function runTimed(): Promise<void> {
    if (!begin()) return;

    const own = new AbortController();

    abort = own;

    for (let index = 0; index < STEPS.length; index += 1) {
      show(index);

      const reached = await enter(index, own.signal);

      if (own.signal.aborted) return;

      if (!reached) {
        restore('The tour stopped.', FAILED_CAPTION);
        return;
      }

      await sleep(STEPS[index]!.hold, own.signal);

      if (own.signal.aborted) return;
    }

    restore('The tour is over. The player is back at the start.', IDLE_CAPTION);
  }

  async function stepOnce(): Promise<void> {
    if (busy) return;

    // Past the last state: put the player back.
    if (stepIndex === STEPS.length - 1) {
      restore('The player is back at the start.', IDLE_CAPTION);
      return;
    }

    busy = true;
    start!.setAttribute('aria-busy', 'true');

    if (stepIndex < 0 && !begin()) {
      busy = false;
      start!.removeAttribute('aria-busy');
      return;
    }

    const own = abort ?? new AbortController();

    abort = own;
    stepIndex += 1;
    show(stepIndex);
    labelStart();

    const reached = await enter(stepIndex, own.signal);

    if (own.signal.aborted) return;

    busy = false;
    start!.removeAttribute('aria-busy');

    if (!reached) restore('The tour stopped.', FAILED_CAPTION);
  }

  start.addEventListener('click', () => {
    if (reduceMotion.matches) void stepOnce();
    else if (!running) void runTimed();
  });

  stop.addEventListener('click', () => restore('The tour was stopped. The player is back at the start.', IDLE_CAPTION));

  document.addEventListener('keydown', (event) => {
    if (running && event.key === 'Escape') restore('The tour was stopped. The player is back at the start.', IDLE_CAPTION);
  });

  // Leaving the section, or the tab, ends it.
  new IntersectionObserver((entries) => {
    if (running && entries.some((entry) => !entry.isIntersecting)) restore('The tour stopped.', IDLE_CAPTION);
  }).observe(section);

  document.addEventListener('visibilitychange', () => {
    if (running && document.hidden) restore('The tour stopped.', IDLE_CAPTION);
  });

  reduceMotion.addEventListener('change', () => {
    if (running) restore('The tour stopped.', IDLE_CAPTION);
    else labelStart();
  });

  show(-1);
  caption.textContent = IDLE_CAPTION;
  labelStart();
}
