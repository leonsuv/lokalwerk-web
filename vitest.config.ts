import { defineConfig } from 'vitest/config';

// Eigene Konfiguration, weil vite.config.ts `pages/` als Root setzt.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['tests/global-setup.ts'],
  },
});
