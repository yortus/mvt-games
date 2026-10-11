import { defineConfig } from 'vsnap/config';

// A project that keeps its visual tests in a visual-tests folder inside each
// view folder, with their reference images beside them. The package's own
// run checks this layout end to end. Run it alone with
// `npm run test:visual:fixture -w vsnap`.
export default defineConfig({
    include: ['src/**/visual-tests/*.test.ts'],
    referencePath: '{testFileDir}/{imageName}.png',
});
