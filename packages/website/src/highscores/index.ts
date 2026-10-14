// The highscore tables' code that the page and the Worker share: the rules,
// the JSON they send each other, and the page's stores. The Worker's own code
// is in `highscores-worker/`, beside `src/`, so none of it reaches a page.

export {
    createFetchHighscoreStore, createMemoryHighscoreStore, type EnteredResult, type FetchHighscoreStoreOptions,
    type HighscoreStore, type HighscoreTables, type MemoryHighscoreStoreOptions, type RefusedResult, type SubmitResult,
} from './client';
export {
    parseRefusalResponse, parseSubmitRequest, parseSubmitResponse, parseTablesResponse, type RefusalResponse,
    STATUS_FOR_REFUSAL, type SubmitRequest, type SubmitResponse, TABLES_PATH, type TablesResponse, toTablePath,
} from './protocol';
export {
    BLOCKED_INITIALS, type EnteredRow, enterRow, findGameRules, findInitialsProblem, findRank, findRefusal, GAMES,
    type GameRules, type GameRulesTable, type HighscoreRow, INITIALS_CHARACTERS, INITIALS_LENGTH, type InitialsProblem,
    isValidInitials, type RefusalReason, type Submission, type SubmissionCheckOptions, TABLE_SIZE,
} from './rules';
