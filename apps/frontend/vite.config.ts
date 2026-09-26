import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { execSync } from 'child_process';

const getGitHash = () => {
  try {
    return `${execSync('git rev-parse --short HEAD').toString().trim()}`;
  } catch {
    // Fallback if git is not available or not a repository
    return 'development';
  }
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    // Inject as a global constant or append to import.meta.env
    'import.meta.env.VITE_BUILD_HASH': JSON.stringify(getGitHash()),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ['@repo/shared'],
  },
  // base: '/my-app/', // set when the app is served from a sub-path
});
