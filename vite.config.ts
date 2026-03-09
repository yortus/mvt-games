import { defineConfig } from 'vite';
import { spritesheetPlugin } from './scripts/vite-plugin-spritesheet';

export default defineConfig({
    plugins: [spritesheetPlugin()],
});
