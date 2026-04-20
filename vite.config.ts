import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return;
            }
            if (id.includes('/lucide-react/')) {
              return 'vendor-icons';
            }
            if (id.includes('/framer-motion/') || id.includes('/motion/')) {
              return 'vendor-motion';
            }
            if (id.includes('/@wecom/jssdk/')) {
              return 'vendor-wecom';
            }
            if (id.includes('/react-markdown/') || id.includes('/remark-') || id.includes('/rehype-')) {
              return 'vendor-markdown';
            }
            if (id.includes('/@google/genai/')) {
              return 'vendor-ai';
            }
          },
        },
      },
    },
  };
});
