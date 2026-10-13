import { defineConfig } from 'vitest/config';

// Config aparte para no cargar los plugins de React/Tailwind de vite.config.js
export default defineConfig({
  test: {
    environment: 'node',
    // Los archivos de reglas comparten un solo emulador de Firestore: se corren de uno en uno
    fileParallelism: false,
    include: ['tests/**/*.test.js'],
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
