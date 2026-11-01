# Skill: Writing and Updating Documentation

> Instructions for AI agents writing or changing the book (*Building Web
> Games with MVT*), a README, or any other prose in this repo. The rules
> themselves are in the Writing Guide; this file says what to read and
> what to check.

---

## Before You Write

1. Read the [Writing Guide](../working-in-this-repo/writing-guide.md) in
   full. It holds the voice, the book's shape, where each idea lives, and
   a chapter's shape.
2. Read one principle's chapter, such as
   [Single Source of Truth](../chapters/27-single-source-of-truth.md),
   to hear the voice the book uses.
3. Find the idea's home in the Writing Guide's "One Home for Each Idea"
   table. Change it there. Elsewhere, link to it.

## Where Things Go

| Writing | Folder |
| --- | --- |
| The book's chapters | `packages/sites/docs/chapters/NN-name.md` |
| The book's appendices | `packages/sites/docs/appendices/X-name.md`, lettered |
| Code style, project layout, the Writing Guide | `packages/sites/docs/working-in-this-repo/` |
| The reading order, the sidebar and old addresses | `packages/sites/docs/.vitepress/book.ts` |
| Agent instructions (not published) | `packages/sites/docs/ai-agents/` and `AGENTS.md` |
| Drafts of essays (not published) | `packages/sites/docs/articles/` |

## Checks Before You Hand Over

- Don't type section numbers in headings. The site adds them.
- Don't add Previous or Next lines. The site writes them from the sidebar.
- Quote a measured figure only from Appendix C's short version.
- No em-dashes.
- `npm run build -w @mvtjs/docs` passes. It fails on a broken link.
- Go through the Writing Guide's "Before You Finish a Page" list.
- If you changed a rule or a convention, update `AGENTS.md` and the skill
  that covers it, and link to the book rather than copying it.
