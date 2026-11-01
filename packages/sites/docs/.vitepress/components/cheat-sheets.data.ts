// The playground's cheat sheets, for Appendix G: made as the site builds, by
// the generator the playground uses, so the book shows the same signatures
// and summaries, read from the libraries' declarations. It takes a few
// seconds, since it loads every library's types. In development, a change to
// a sheet makes them again. They're imported by path, as TryIt.vue finds the
// playground's examples, so that VitePress bundles them with this file.
import { CHEAT_SHEETS, LEFT_OUT, type ReferenceSheet } from '../../../playground/cheat-sheets/index.ts';
import { makeReferenceSheets } from '../../../playground/scripts/make-reference-sheets.ts';

export default {
    watch: ['../../../playground/cheat-sheets/*.ts'],
    load(): readonly ReferenceSheet[] {
        return makeReferenceSheets({ sheets: CHEAT_SHEETS, leftOut: LEFT_OUT }).sheets;
    },
};

export declare const data: readonly ReferenceSheet[];
