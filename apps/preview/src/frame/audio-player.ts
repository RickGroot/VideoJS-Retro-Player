import '@videojs/html/audio/player';
import '@videojs/html/media/mux-audio';
import '@/audio/skin';
import skinTemplate from '@/audio/skin.html?raw';

// What the audio preview plays. Placeholder: the sound of the video preview's stream, until the demo track is in.
const SRC = 'https://stream.mux.com/83EzHOvVzVN01AsrD01BCpiH02Pj3S8mfzBOu101w2nHC5s.m3u8';
/** Chapters for the time slider, served from `apps/preview/public`. */
const CHAPTERS = './cosmic-dawn-chapters.vtt';

const MEDIA_PLACEHOLDER = '<!-- Add a compatible media component here. -->';

export function createAudioPlayer(): HTMLElement {
  const player = document.createElement('audio-player');

  player.innerHTML = skinTemplate.replace(
    MEDIA_PLACEHOLDER,
    `<mux-audio src="${SRC}" crossorigin><track kind="chapters" label="English" srclang="en" src="${CHAPTERS}" default></mux-audio>`
  );

  return player;
}
