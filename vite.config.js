import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS === 'true' ? '/ANIT-ASSOCIACAO-DE-INSTRUTORES/' : '/',
  plugins: [tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        admin: 'admin.html',
        auth: 'auth.html'
      }
    }
  }
});