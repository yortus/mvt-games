import { defineConfig } from 'vite';
import { spritesheetPlugin } from './scripts/vite-plugin-spritesheet';

export default defineConfig({
    base: process.env.BASE_URL ?? '/',
    plugins: [spritesheetPlugin()],
});
