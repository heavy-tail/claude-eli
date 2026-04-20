---
name: dummies-glossary
description: >
  Extract every technical term, acronym, library/product name, CLI flag, env var,
  or other jargon from the previous assistant answer and produce a plain-language
  definition reference card. Trigger: /dummy-glossary, "glossary", "용어 정리해줘".
  One-shot — does NOT change the active Dummies stage.
---

# Dummies Glossary

One-shot. Extract jargon from the previous assistant answer and output a reference card.

## What counts as jargon

Include if a beginner would not know it:
- Technical terms (e.g. `middleware`, `fluid compute`, `SSR`)
- Acronyms (e.g. `CORS`, `JWT`, `AST`, `REST`)
- Library / product / service names (e.g. `Vercel`, `Next.js`, `Tailwind`)
- CLI flags and commands (e.g. `--prod`, `vercel deploy`, `npm install -g`)
- Env var names (e.g. `NODE_ENV`, `DATABASE_URL`)
- File conventions (e.g. `.env.local`, `package.json`)

Exclude if a non-technical adult already knows it (e.g. `website`, `password`, `folder`, `click`).

## Format

For each item, list:

1. **Term verbatim** — exactly as it appeared. Use inline code formatting if it was code.
2. **Plain definition** — 1-2 sentences, culturally neutral (no regional idioms or sports).
3. **In context** — a short note on how it was used in the previous answer.

Order by appearance in the original answer. Use a bulleted list.

## Important

- **No analogies.** Glossary is a reference card — the main Dummies mode already provides analogies. Keep definitions clean and direct.
- **Do not change the stage.** This is a one-shot display. No flag writes.
- **Preserve verbatim** all code-looking items (commands, flags, paths, etc.).

## Fallback

If the previous answer had no jargon worth translating, respond:

> No jargon to translate in the previous answer.

## Example output

Suppose the previous answer mentioned `vercel deploy`, `environment variables`, `.env.local`, and `.gitignore`. Then:

- `vercel deploy` — CLI command that uploads your site to Vercel. Used in the answer as the command to run from the project root to publish the site.
- **environment variable** — A named value stored outside your code (e.g. in a dashboard or a separate file), read at runtime. Used in the answer as the place to keep API keys and secrets so they don't end up in your code.
- `.env.local` — A local-only file where you store environment variables for development. Used in the answer as the file where you list values like `API_KEY=...`.
- `.gitignore` — A file listing paths Git should ignore. Used in the answer to keep `.env.local` out of the repository.
