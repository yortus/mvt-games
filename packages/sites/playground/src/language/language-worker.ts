// The language service's worker: TypeScript's language service over the
// project, so that its work never holds up the page. The page calls it
// through Comlink, which makes each of the service's functions a call that
// returns a promise.
import * as Comlink from 'comlink';
import ts from 'typescript';
import { TYPE_BUNDLE_URLS } from 'virtual:library-types';
import { createProjectLanguageService } from './project-language-service';

Comlink.expose(createProjectLanguageService({
    ts,
    loadBundle: async (kind) => {
        const response = await fetch(TYPE_BUNDLE_URLS[kind]);
        return await response.json() as Record<string, string>;
    },
}));
