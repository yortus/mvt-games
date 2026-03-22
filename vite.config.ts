import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { spritesheetPlugin } from './scripts/vite-plugin-spritesheet';

/** Redirect `/playground` to `/playground/` so Vite serves playground/index.html. */
function playgroundRewritePlugin(): Plugin {
    return {
        name: 'playground-rewrite',
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                if (req.url === '/playground') {
                    res.writeHead(302, { 'Location': '/playground/' });
                    res.end();
                    return;
                }
                next();
            });
        },
    };
}

export default defineConfig({
    base: process.env.BASE_URL ?? '/',
    plugins: [spritesheetPlugin(), playgroundRewritePlugin()],
    build: {
        rollupOptions: {
            input: {
                'main': resolve(__dirname, 'index.html'),
                'playground': resolve(__dirname, 'playground/index.html'),
                'playground-sandbox': resolve(__dirname, 'playground/sandbox.html'),
            },
        },
    },
});
