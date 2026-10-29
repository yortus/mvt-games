// This is the setup file of the visual tests' Vitest projects. It runs before
// each test file (see src/node/config.ts). The page is set up once,
// and checked against the reference environment before any test. Every test
// then starts from the same state.
import { beforeEach } from 'vitest';
import { setUpPage } from './page-setup';
import { forgetImageNames } from './visual-test';

const setup = await setUpPage();
// Canvas test files share one page, so the image names of the file before
// this one are forgotten.
forgetImageNames();

beforeEach(() => {
    setup.resetForTest();
});
