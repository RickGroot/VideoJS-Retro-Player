import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const path = (file: string) => fileURLToPath(new URL(file, import.meta.url));

// apps/preview serves the demo page and the workbench; `@/` imports reach the skin in src/.
export default defineConfig({
  root: path('./apps/preview'),
  // Relative URLs, so the build works at a domain root or in a subfolder such as GitHub Pages.
  base: './',
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      '@preview': path('./apps/preview/src'),
      '@': path('./src'),
    },
  },
  server: {
    fs: { allow: [path('.')] },
  },
  build: {
    outDir: path('./dist'),
    emptyOutDir: true,
    // Browsers that know `light-dark()`, so the minifier leaves it alone. Lowered, it only follows a colour scheme
    // set in a stylesheet rule, and the pages set a forced scheme as an inline style.
    cssTarget: ['chrome123', 'edge123', 'firefox120', 'safari17.5'],
    rolldownOptions: {
      // The public demo page, the workbench shell, the video preview it frames, and the audio skin's own preview page.
      input: {
        demo: path('./apps/preview/index.html'),
        workbench: path('./apps/preview/workbench.html'),
        preview: path('./apps/preview/preview.html'),
        audio: path('./apps/preview/audio.html'),
      },
    },
  },
});
