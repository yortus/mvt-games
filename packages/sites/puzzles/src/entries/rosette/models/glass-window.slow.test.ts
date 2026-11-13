import { describeGlassWindowChecks } from './glass-window-checks.test-support';

// Twelve days' windows at every level and in every frame, so each frame is
// cut from twelve tilings, which takes most of a second.
// glass-window.test.ts checks two.
describeGlassWindowChecks({ days: 12 });
