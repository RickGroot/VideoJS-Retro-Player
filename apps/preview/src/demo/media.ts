// All media for the demo page lives here. Change these to try the skins with your own media; any Mux or HLS URL works.

/** The video: NASA's "Cosmic Dawn" trailer, streamed from Mux. */
export const VIDEO_SRC = 'https://stream.mux.com/83EzHOvVzVN01AsrD01BCpiH02Pj3S8mfzBOu101w2nHC5s.m3u8';
export const VIDEO_POSTER = 'https://image.mux.com/83EzHOvVzVN01AsrD01BCpiH02Pj3S8mfzBOu101w2nHC5s/thumbnail.webp?time=69';

/** The intro of the clip in seconds (start-end), so the skip pill can be seen. */
export const VIDEO_SKIP_INTRO = '1-12';

/** The audio. Placeholder: the sound of the video's stream, until a demo track is in. */
export const AUDIO_SRC = VIDEO_SRC;
/** Square artwork for the audio cover. */
export const AUDIO_POSTER =
  'https://image.mux.com/83EzHOvVzVN01AsrD01BCpiH02Pj3S8mfzBOu101w2nHC5s/thumbnail.webp?width=640&height=640&fit_mode=crop&time=20';

export const AUDIO_TITLE = 'Cosmic Dawn';
export const AUDIO_LONG_TITLE =
  'Cosmic Dawn (Extended Remastered Edition) with a Very Long Subtitle That Keeps Going and Going Past Three Lines';

/** Chapters for the time slider, served from `apps/preview/public`. */
export const CHAPTERS = './cosmic-dawn-chapters.vtt';

/** A source that cannot play, for the "Break it" buttons: it shows the error panel. */
export const BROKEN_SRC = 'https://stream.mux.com/this-playback-id-does-not-exist.m3u8';

/** What the demo clip is called in the PLAY YOUR OWN box's messages. */
export const DEMO_LABEL = 'the demo clip';

/**
 * One example of a live stream: Mux's live test stream, the playback ID that Video.js's own documentation uses for its
 * live players. It is third party, may go away, and is only ever offered as a labelled example, never as a default.
 */
export const LIVE_SRC = 'https://stream.mux.com/v69RSHhFelSm4701snP22dYz2jICy4E4FUyk02rW4gxRM.m3u8';
