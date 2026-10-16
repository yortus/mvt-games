export { createLanguageClient, type LanguageClient, type LanguageClientOptions } from './language-client';
export type {
    CodeFix,
    CompletionDetails,
    CompletionEntry,
    CompletionList,
    DefinitionTarget,
    FileEdit,
    QuickInfo,
    SignatureHelp,
    TypeProblem,
} from './language-types';
export {
    createProjectLanguageService,
    type ProjectLanguageService,
    type ProjectLanguageServiceOptions,
    type ServiceFile,
} from './project-language-service';
