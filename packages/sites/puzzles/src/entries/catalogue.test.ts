import { describeCatalogue } from '@mvtjs/site-kit/testing';
import { SITE } from '../site';

describeCatalogue({
    site: SITE,
    entryBarrels: Object.keys(import.meta.glob('./*/index.ts')),
    textureFiles: Object.keys(import.meta.glob('./*/assets/*.png')),
});
