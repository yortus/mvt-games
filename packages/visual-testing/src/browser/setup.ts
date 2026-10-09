// This is the setup file of the visual tests' Vitest projects. It runs before
// each test file (see src/node/projects.ts). The page is set up once,
// and checked against the reference environment before any test. Every test
// then starts from the same state.
import { beforeEach } from 'vitest';
import { setUpPage } from './page-setup';

const setup = await setUpPage();

beforeEach(() => {
    setup.resetForTest();
});
