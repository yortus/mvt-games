// The unit tests' setup. It imports a module that only Node has, so it
// fails if it runs in v-snap's browser page.
import { platform } from 'node:os';

(globalThis as { unitSetup?: string }).unitSetup = platform();
