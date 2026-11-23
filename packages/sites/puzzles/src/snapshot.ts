import { startSnapshotPage } from '@mvtjs/site-kit/snapshot';
import { CATALOGUE } from './entries';
import { showcase } from './showcase';

// The snapshot page (`snapshot.html`), which `generate-thumbnails` photographs each entry and the showcase on
startSnapshotPage([...CATALOGUE, showcase]);
