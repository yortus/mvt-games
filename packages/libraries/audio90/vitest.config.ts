import { defineConfig } from 'vitest/config';

// audio90's tests, all unit tests, run in Node. `npm test` runs them.
export default defineConfig({
    test: {
        name: 'unit',
        include: ['src/**/*.test.ts'],
    },
});
