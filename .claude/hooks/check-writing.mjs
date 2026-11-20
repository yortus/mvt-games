// A Claude Code hook, run after each Edit or Write (see .claude/settings.json).
// When the new text holds prose, such as Markdown, a comment or a sentence in a
// string, it reminds the agent of the Writing Guide, and lists the sentences
// that show the habits the guide asks you to avoid. It only reports: it never
// blocks an edit. Each check is a rough pattern, so a sentence it lists may
// still be fine; the agent reads each one and decides.
import { readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

/** How many flagged sentences to list, at most, so a long new file doesn't bury the reminder. */
const MOST_FLAGS = 8;

const input = JSON.parse(readFileSync(0, 'utf8'));
const projectDir = resolve(process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
const filePath = resolve(input.tool_input?.file_path ?? '');
const relativePath = relative(projectDir, filePath).replaceAll('\\', '/');

// Files outside the repo, such as an agent's own memory, follow their own rules
// (on another drive, the relative path comes back absolute)
const isInRepo = relativePath !== '' && !relativePath.startsWith('..') && !isAbsolute(relativePath);
const isMarkdown = /\.md$/.test(relativePath);
const isCode = /\.(ts|tsx|mts|js|mjs)$/.test(relativePath);
if (!isInRepo || !(isMarkdown || isCode) || /(^|\/)(node_modules|dist)\//.test(relativePath)) process.exit(0);

const newText = [
    input.tool_input?.new_string,
    input.tool_input?.content,
    ...(input.tool_input?.edits ?? []).map((edit) => edit.new_string),
].filter((text) => typeof text === 'string').join('\n');

const prose = isMarkdown ? readMarkdownProse(newText) : readCodeProse(newText);
const sentences = prose.flatMap((passage) => passage.split(/(?<=[.!?])\s+(?=[A-Z`"'(])/)).map((s) => s.trim()).filter((s) => s.split(/\s+/).length >= 4);
if (sentences.length === 0) process.exit(0);

const CHECKS = [
    { name: 'long sentence (over 30 words): split it', test: (s) => s.split(/\s+/).length > 30 },
    { name: 'semicolon joining two sentences: split it', test: (s) => /\w; \w/.test(s) },
    { name: 'colon joining a list or a second clause: split it into sentences', test: (s) => /\w: [a-z]/.test(s.replace(/https?:\/\/\S+/g, '')) },
    { name: 'negative on a noun (no, nothing, none): put it on the verb', test: (s) => /\b(no|nothing|none|nobody)\b/i.test(s) },
    { name: 'code described as a person (gives, takes, hands, asks, tells, knows, wants, promises)', test: (s) => /\b(gives?|takes?|hands?|asks?|tells?|knows?|wants?|promises?)\b/.test(s) },
    { name: 'em-dash: use a hyphen, or restructure', test: (s) => s.includes('—') },
];
const flags = [];
for (const sentence of sentences) {
    for (const check of CHECKS) {
        if (check.test(sentence)) flags.push(`- ${check.name}: "${shorten(sentence)}"`);
    }
}

const reminder = [
    `This edit to ${relativePath} adds prose. Check it against packages/sites/docs/working-in-this-repo/writing-guide.md`,
    '(The Voice, Sentences, Phrasing): talk to the reader as "you", one idea to a short complete sentence, say why as well',
    'as what, explain each term where it first appears, use the verbs that describe code, and rewrite a paragraph you touch',
    'to the guide rather than matching the text around it.',
    ...(flags.length > 0 ? ['', 'Sentences to look at again (rough patterns, so some may be fine):', ...flags.slice(0, MOST_FLAGS)] : []),
    ...(flags.length > MOST_FLAGS ? [`- and ${flags.length - MOST_FLAGS} more`] : []),
].join('\n');

process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: reminder } }));

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Returns the passages of Markdown that are prose: everything outside code blocks, tables and front matter. */
function readMarkdownProse(text) {
    const withoutCode = text.replace(/^---\n[\s\S]*?\n---\n/, '').replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, 'code');
    return withoutCode.split(/\n\s*\n/).filter((passage) => !/^\s*\|/.test(passage)).map((passage) => passage.replace(/\s+/g, ' '));
}

/** Returns the prose in code: each comment's text, and each string that reads as a sentence. */
function readCodeProse(text) {
    const passages = [];
    const comments = text.match(/\/\*\*?[\s\S]*?\*\/|\/\/.*$/gm) ?? [];
    for (const comment of comments) {
        const words = comment.replace(/^\/\*\*?|\*\/$/g, '').replace(/^\s*\*\s?/gm, '').replace(/^\/\/\s?/gm, '');
        if (!/eslint-disable|@ts-/.test(words)) passages.push(words.replace(/\s+/g, ' '));
    }
    // A string reads as a sentence if it has at least five words; strings joined with + are read as one
    const joined = text.replace(/['"`]\s*\n\s*\+\s*['"`]/g, '');
    const strings = joined.match(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g) ?? [];
    for (const string of strings) {
        const words = string.slice(1, -1).replace(/\\(.)/g, '$1');
        if (words.split(/\s+/).length >= 5) passages.push(words);
    }
    return passages;
}

function shorten(sentence) {
    return sentence.length > 140 ? `${sentence.slice(0, 137)}...` : sentence;
}
