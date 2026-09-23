---
name: deploy
description: The Postly deployment runbook (Render backend + Vercel frontend) and the current deploy state. Use this whenever the user asks about deployment status, what phase or step they're on, how to deploy, what's left before launch, where a deploy got stuck, or anything about Render, Vercel, DATABASE_URL, CORS/CSRF origins, the email outbox cron, or going live. Use it even when the question is phrased casually, e.g. "where are we with the deploy" or "can I ship yet".
allowed-tools: Read Grep Bash(cat *) Bash(git status *) Bash(git log *)
---

# Postly deploy

Eight phases from laptop to a live URL. Phases 1-6 reach a working public site on
free hosting; 7 and 8 are pre-launch work. The full text of every phase is in
`playbook.md` in this directory.

## Current deploy state

```!
cat ${CLAUDE_SKILL_DIR}/state.md || true
```

## Working tree right now

```!
git status --short || true
```

## How to answer

1. **Report position first.** Name the current phase, what's already ticked, and
   the single next unchecked task. Two or three sentences, not a wall of text.
2. **Read only what's needed.** Open `playbook.md` and pull out the current phase
   plus the one after it. Never paste the whole runbook back at the user.
3. **Give exact commands and exact values.** The runbook's commands, env var
   names and table values are the source of truth — reproduce them verbatim
   rather than paraphrasing. A wrong `DJANGO_SETTINGS_MODULE` costs an hour.
4. **Respect the gates.** Phase 2 ends with a hard gate: nothing after it is
   valid until `/admin/` renders *with styling*. If the user asks about phase 4+
   while that gate is unticked, say so before answering.
5. **Tick as you go.** When the user confirms a task is done, edit `state.md` to
   check that box and move the `← current` marker. Don't tick anything the user
   hasn't confirmed.
6. **Flag drift.** If the repo contradicts the runbook (a settings file moved, a
   variable was renamed), say so rather than following the runbook off a cliff.
   The runbook was written against `main` at a point in time.

## Never do these unprompted

- `git push`, or any Render/Vercel deploy trigger — the user pushes.
- Print, echo or store a generated `DJANGO_SECRET_KEY`, `DATABASE_URL`,
  `EMAIL_HOST_PASSWORD` or `RESEND_WEBHOOK_SECRET`. They live only in the
  provider's environment settings.
- Add `.env` or `db.sqlite3` to a commit. Both are gitignored; keep it that way.
- Suggest submitting to the HSTS preload list. Phase 7 explains why.

## Phase index

| # | Phase | Time |
|---|---|---|
| 1 | Push what's on your machine | ~5 min |
| 2 | Postgres and Django on Render | ~25 min |
| 3 | Give yourself a login | ~10 min |
| 4 | Frontend on Vercel | ~10 min |
| 5 | Close the loop (real origins) | ~5 min |
| 6 | Smoke test the live product | ~10 min |
| 7 | Your own domain | when you have one |
| 8 | Before real writers arrive | pre-launch |

Full detail for every phase: [playbook.md](playbook.md)