<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Fresh-CAN Engineering Rules

## Architecture boundaries
- All four content types (blog, image_post, video, social) run on Inngest: functions in `src/inngest/functions/`, step/adapter/db logic in `src/server/pipeline/`, served from `src/app/api/inngest/route.ts`. n8n is fully retired and the old polling `worker/` is removed. `npm run dev` at the repo root is the only process to start.
- Pipeline-owned state (jobs/pipelines/tracks/drafts/generated content) is written only through a backend API route (`src/app/api/jobs/[jobId]/...`, `src/app/api/social/post/`) — never directly from a component via the anon Supabase client.
- API routes create/update rows and send an Inngest event; there is no queue or polling loop. Only Inngest functions (via `src/server/pipeline/adapters/`) call external providers (OpenAI, KIE.ai, ElevenLabs, AssemblyAI, upload-post.com) directly.
- Video defaults to the single-shot Seedance flow (`src/inngest/functions/singleShot.ts`); `ENABLE_SINGLE_SHOT=false` falls back to the older scene-by-scene pipeline. A failed draft stage is restarted via `POST /video/generate`, a failure after approval via `/video/resume`.
- Prompts are layered (brand truth → intent → per-type plan → render prompt → guards); see `docs/PROMPT_ARCHITECTURE.md` before changing prompt code. Image-bearing types (image_post, blog) also run a creative-twist step (`steps/shared/creativeTwist.ts`).

## Database safety
- Never assume a table, column, or constraint exists — check `docs/DATABASE_DESIGN.md` and, where it matters, the live schema before writing a query. (This codebase has one confirmed live case of code silently drifting from the real constraint — see `docs/DECISIONS.md`.)
- Migrations are additive only: no dropped or renamed columns on `content_drafts`, `generated_content`, `content_jobs`, `social_posts`, `social_platform_logs` without explicit sign-off.
- A schema change isn't written until it's reflected in `docs/DATABASE_DESIGN.md`'s current → target mapping.

## API / backend ownership
- Pipeline-owned mutations (job/pipeline/track state, draft edits, approvals, regeneration, retry) get a dedicated backend API route — they are not added to `contentService.ts` as another direct-client-call function.
- `contentService.ts` holds the UI's Supabase calls (read path); it is not the write path for pipeline-owned tables. New endpoints are documented in `API_DOCS.md`.

## Idempotency
- Every new mutating endpoint and every Inngest step handler must be safe to call twice: check for an existing successful record for the same (pipeline or track, step, generation) before doing provider work or writing a result.
- Before adding any new `upsert`, confirm its `onConflict` target matches a real live unique constraint — this exact class of bug already exists once in this codebase.

## Testing
- Verification is `npx tsc --noEmit` plus Vitest on the specific files you touched. Run unit tests by file path, never a whole folder: e2e tests (`*.e2e.test.ts`) write real rows to the live Supabase DB.
- Pure logic (prompt composers, normalizers, backoff, adapters against a mocked `fetch`) is unit-tested and must actually pass, not just typecheck. DB-touching tests are gated on credentials; never claim one "passed" when it only skipped.
- Never run paid provider calls (KIE, OpenAI image, ElevenLabs) without confirming count and cost first. Use `KIE_FAKE_MODE` for pipeline runs that don't need real renders.

## Scope
- Keep changes scoped to what the task names; don't build ahead or refactor opportunistically.

## Avoiding unrelated changes
- Don't fix pre-existing issues noticed in passing (e.g. the `twitter`/`x` enum duplication, the unused `job_overview` view, the `video_url` column question) unless asked — note them in `docs/DECISIONS.md` or flag them, don't silently touch them.
- Keep changes scoped to what the current milestone names.

## Docs stay in sync
- A change that alters pipeline/job/status/track behavior updates the relevant doc (`SPECIFICATIONS.md`, `ARCHITECTURE.MD`, `docs/DATABASE_DESIGN.md`, `docs/DECISIONS.md`) in the same change, not after.

## Keeping agent docs in sync
- `AGENTS.md` (other coding agents) and `CLAUDE.md` (Claude Code) describe the same project. A change to architecture, stack, commands or rules updates BOTH in the same change. Leave the auto-generated `nextjs-agent-rules` block at the top of this file as is.
