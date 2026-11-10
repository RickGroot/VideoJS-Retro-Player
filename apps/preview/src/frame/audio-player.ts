import '@videojs/html/audio/player';
import '@videojs/html/media/mux-audio';
import '@/audio/skin';
import skinTemplate from '@/audio/skin.html?raw';

// What the audio preview plays. Placeholder: the sound of the video preview's stream, until the demo track is in.
const SRC = 'https://stream.mux.com/83EzHOvVzVN01AsrD01BCpiH02Pj3S8mfzBOu101w2nHC5s.m3u8';
/** Chapters for the time slider, served from `apps/preview/public`. */
const CHAPTERS = './cosmic-dawn-chapters.vtt';
/** Artwork for the cover. */
const POSTER = 'https://image.mux.com/83EzHOvVzVN01AsrD01BCpiH02Pj3S8mfzBOu101w2nHC5s/thumbnail.webp?width=640&height=640&fit_mode=crop&time=20';
const TITLE = 'Cosmic Dawn';
const LONG_TITLE =
  'Cosmic Dawn (Extended Remastered Edition) with a Very Long Subtitle That Keeps Going and Going Past Three Lines';

const MEDIA_PLACEHOLDER = '<!-- Add a compatible media component here. -->';

/**
 * Preview switches, read from the page query so the edge cases can be looked at without editing code:
 * `?art=none|broken` (no artwork / an image that fails) and `?title=long|none`.
 */
export function createAudioPlayer(): HTMLElement {
  const player = document.createElement('audio-player');
  const query = new URLSearchParams(window.location.search);
  const art = query.get('art');
  const title = query.get('title');

  player.innerHTML = skinTemplate.replace(
    MEDIA_PLACEHOLDER,
    `<mux-audio src="${SRC}" crossorigin><track kind="chapters" label="English" srclang="en" src="${CHAPTERS}" default></mux-audio>`
  );

  if (art === 'none') player.setAttribute('poster', '');
  else if (art === 'broken') player.setAttribute('poster', './missing-artwork.webp');
  else player.setAttribute('poster', POSTER);

  if (title === 'long') player.setAttribute('content-title', LONG_TITLE);
  else if (title === 'none') player.setAttribute('content-title', ''); // empty, so the stream's own metadata title is not used
  else player.setAttribute('content-title', TITLE);

  return player;
}
