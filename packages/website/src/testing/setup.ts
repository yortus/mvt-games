// The visual projects' setup file, run before each test file (scripts/visual/projects.ts).
// The page is set up once, and checked against the reference environment
// before any test; every test then starts from the same state.
import { beforeEach } from 'vitest';
import { pageSetup } from './page-setup';

const setup = await pageSetup();

beforeEach(() => {
    setup.resetForTest();
});
