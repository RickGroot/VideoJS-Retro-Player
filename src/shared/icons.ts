import { registerIcons } from '@videojs/html/icons';

/**
 * Sleeve icons: printed, not drawn. Solid shapes on an 18x18 grid, filled with
 * currentColor, mitred square corners, geometry on whole or half pixels.
 * Knock-outs use fill-rule="evenodd" inside a single path.
 */
const svg = (body: string, extra = ''): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" aria-hidden="true" viewBox="0 0 18 18">${extra}${body}</svg>`;

const solid = (d: string): string => svg(`<path d="${d}"/>`);
const knockout = (d: string): string => svg(`<path fill-rule="evenodd" d="${d}"/>`);

// Playback
export const playIcon = solid('M4 2l11 7-11 7z');
export const pauseIcon = solid('M3.5 2h4v14h-4zM10.5 2h4v14h-4z');

// Square-cornered loop with a head pointing left on the top edge.
export const restartIcon = solid('M7 4h8v12H3V9h2v5h8V6H7zM2.5 5l5-4v8z');

// Faces forward (clockwise, head at the upper right). The skin mirrors it for backward.
export const seekIcon = solid('M3 3h10v4h2.5L12 12 8.5 7H11V5H5v11H3z');

// Ring segment (270 degrees). The animation is read from --media-spinner-animation
// so the skin can switch it off, e.g. for reduced motion.
export const spinnerIcon = svg(
  '<path d="M9 2A7 7 0 1 1 2 9h2.5A4.5 4.5 0 1 0 9 4.5z" style="transform-box:view-box;transform-origin:center;animation:var(--media-spinner-animation, sleeve-spinner-spin 0.8s linear infinite)"/>',
  '<style>@keyframes sleeve-spinner-spin{to{transform:rotate(360deg)}}</style>',
);

// Menu
export const checkIcon = solid('M2 9l1.75-1.75L7.5 11l7.25-7.25L16.5 5.5l-9 9z');
export const chevronIcon = solid('M6 3h3l5.5 6L9 15H6l5.5-6z');
export const gearIcon = knockout(
  'M4 4h10v10H4zM7 2h4v2H7zM7 14h4v2H7zM2 7h2v4H2zM14 7h2v4h-2zM6.5 6.5v5h5v-5z',
);
export const switchesIcon = solid(
  'M2 4h7v2H2zM10 2h3v6h-3zM14 4h2v2h-2zM2 12h2v2H2zM5 10h3v6H5zM9 12h7v2H9z',
);
export const speedIcon = solid('M2 3l7 6-7 6zM9 3l7 6-7 6z');
export const speechIcon = knockout(
  'M2 3h14v9H9l-4 3.5V12H2zM4.5 5.5v2h9v-2zM4.5 8.5v2h6v-2z',
);

// Volume: speaker block plus square bars. Off swaps the bars for a square-stroked x.
const speaker = 'M2 7h3.5L10 3v12l-4.5-4H2z';
export const volumeLowIcon = solid(`${speaker}M11.5 7h2v4h-2z`);
export const volumeHighIcon = solid(`${speaker}M11.5 7h2v4h-2zM14.5 3.5h2v11h-2z`);
export const volumeOffIcon = solid(`${speaker}M11 5.5h2.5l3.5 7h-2.5zM14.5 5.5H17l-3.5 7H11z`);

// Fullscreen: four corner brackets, turned inward on exit.
export const fullscreenEnterIcon = solid(
  'M2 2h5v2H4v3H2zM16 2h-5v2h3v3h2zM2 16h5v-2H4v-3H2zM16 16h-5v-2h3v-3h2z',
);
export const fullscreenExitIcon = solid(
  'M7 2H5v3H2v2h5zM11 2h2v3h3v2h-5zM7 16H5v-3H2v-2h5zM11 16h2v-3h3v-2h-5z',
);

// Captions: solid with two knocked-out lines when on, an empty frame when off.
export const captionsOnIcon = knockout('M2 3h14v12H2zM4 6h10v2H4zM4 10h7v2H4z');
export const captionsOffIcon = knockout('M2 3h14v12H2zM4 5v8h10V5z');

// Picture in picture: frame with a solid inset block; on exit the frame is solid with a hole.
export const pipEnterIcon = knockout('M2 3h14v12H2zM4 5v8h10V5zM8 8h5v4H8z');
export const pipExitIcon = knockout('M2 3h14v12H2zM8 8h5v4H8z');

// Cast: screen with square waves in the open corner; solid right half while casting.
const castWaves = 'M2 13h2v2H2zM2 9h5v6H5v-4H2zM2 6h8v9H8V8H2z';
export const castEnterIcon = solid(`M2 3h14v12h-5v-2h3V5H2z${castWaves}`);
export const castExitIcon = solid(`M2 3h14v12h-5V5H2z${castWaves}`);

// AirPlay: screen open at the bottom with a solid triangle; a solid block inside while active.
const airplayFrame = 'M2 3h14v10h-3v-2h1V5H4v6h1v2H2z';
export const airPlayEnterIcon = solid(`${airplayFrame}M9 10l4.5 6h-9z`);
export const airPlayExitIcon = solid(`${airplayFrame}M9 10l4.5 6h-9zM6 7h6v2H6z`);

export const sleeveIcons = {
  'airplay-enter': airPlayEnterIcon,
  'airplay-exit': airPlayExitIcon,
  'captions-off': captionsOffIcon,
  'captions-on': captionsOnIcon,
  'cast-enter': castEnterIcon,
  'cast-exit': castExitIcon,
  check: checkIcon,
  chevron: chevronIcon,
  'fullscreen-enter': fullscreenEnterIcon,
  'fullscreen-exit': fullscreenExitIcon,
  gear: gearIcon,
  pause: pauseIcon,
  'pip-enter': pipEnterIcon,
  'pip-exit': pipExitIcon,
  play: playIcon,
  restart: restartIcon,
  seek: seekIcon,
  speech: speechIcon,
  speed: speedIcon,
  spinner: spinnerIcon,
  switches: switchesIcon,
  'volume-high': volumeHighIcon,
  'volume-low': volumeLowIcon,
  'volume-off': volumeOffIcon,
};

let registered = false;

/** Registers the Sleeve icon family once, however many skins import it. */
export function registerSleeveIcons(): void {
  if (registered) return;
  registered = true;
  registerIcons('sleeve', sleeveIcons);
}

registerSleeveIcons();
