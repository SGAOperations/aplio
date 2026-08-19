---
name: implement
description: Run pipeline stage 2 or 4 yourself, in your own session, for a ticket marked SESSION REQUIRED — one that cannot be handed to a dispatched agent, today because it touches CLAUDE.md or .claude/**. Resolves the stage from the item's labels, works in a dedicated worktree, and follows the existing impl-agent / revise-agent definitions unchanged. Manual only. Usage: /implement <issue-or-pr-number>
disable-model-invocation: true
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, AskUserQuestion
---

# Implement — operator-run pipeline stage

**Trigger:** manual, in an operator's own session. **Input:** an issue or PR number (`<n>`). **Repo:** `SGAOperations/aplio`.

The harness denies `Edit`/`Write` under `.claude/` to **dispatched subagents**, and `settings.json` cannot grant it back — so `impl-agent` and `revise-agent` can't run for tickets that touch `CLAUDE.md` or `.claude/**`. Your session has no such restriction. Those tickets are marked **`SESSION REQUIRED`** in their body, and the cockpit announces them instead of dispatching. This skill is a **thin wrapper**: it points you at the existing agent definition and overrides only the rules that exist because that agent is a subagent. Background and rationale: `.claude/docs/PIPELINE.md` → "Session-required tickets".

**The agent files are the workflow. Do not modify them, and do not reimplement them here.**

## 1. Name this session (first output line)

Derive `#<issue>: <2–5 lowercase words>` from the issue title — e.g. `#503: operator config route` — and print it as your first line:

> Name this session: `#503: operator config route`

If the session wasn't launched with `claude -n "<that string>"`, tell the operator to relaunch with `-n` (or rename in-client, if their client supports it). You can neither read nor set your own display name, so this is an instruction to the human — **state it and move on; never block on it.** In revise mode the name still carries the **issue** number, not the PR number.

## 2. Record the main checkout

```bash
git rev-parse --show-toplevel
```

Keep that path. **Every instruction file is read by absolute path from there** — `.claude/agents/impl-agent.md`, `.claude/agents/revise-agent.md`, `.claude/docs/ENGINEERING.md`, `.claude/docs/PIPELINE.md`, `CLAUDE.md` — and **every edit goes only to paths inside the worktree.** That split is what makes a ticket that edits `impl-agent.md` safe: you follow the committed version while changing the worktree copy.

## 3. Resolve the mode from state

```bash
gh pr view <n> --repo SGAOperations/aplio --json labels,headRefName,baseRefName,title
```

- Resolves to a PR labeled `needs revision` → **revise mode** (`.claude/agents/revise-agent.md`).
- Otherwise:

  ```bash
  gh issue view <n> --repo SGAOperations/aplio --json labels,assignees,title
  ```

  Labeled `plan approved` → **impl mode** (`.claude/agents/impl-agent.md`). **Record the issue's assignee login** (`@me` if none) — the PR must carry it.

- Anything else → stop, report the current labels, change nothing: `#<n> is not awaiting an operator (labels: …). Nothing was changed.`

**If the item carries the trigger label but its body has no `SESSION REQUIRED` marker,** ask first (AskUserQuestion): _"#412 isn't marked `SESSION REQUIRED`, so the cockpit will dispatch an agent for it too. Proceed anyway / Cancel."_ A double dispatch — cockpit and operator on the same item — is the hazard this guards.

Then report the resolved mode, worktree path and branch before the slow steps, so the operator can see you picked the right stage.

## 4. Create the worktree

Never work in the main checkout: editing `.claude/` from the session using it mutates your live configuration mid-task. Never touch another worktree, and never `--force`.

**impl mode** — branch straight off `dev` (this replaces the agent's checkout-`main`-then-rebase):

```bash
git fetch origin
git worktree add -b <n>-ticket-name-in-kebab-case .claude/worktrees/impl-<n> origin/dev
```

**revise mode** — detached at the PR's head, rebased onto its base (per `revise-agent.md` step 2; push by refspec at the end):

```bash
git fetch origin
git worktree add --detach .claude/worktrees/impl-<n> origin/<headRefName>
```

Then `cd` into the worktree and bootstrap it — this is also what activates the commit hooks there:

```bash
npm ci
npm run prisma:generate
```

In revise mode, rebase onto the base branch from inside the worktree: `git rebase origin/<baseRefName>`.

## 5. Follow the agent file

Read the resolved agent file from the **main checkout** and follow it end to end: label swaps, the plan checklist, the `.temp/commit-msg.txt` commit format, the three CI checks, push by refspec, PR body format, base `dev`, the issue's assignee, thread resolution, the revision note. Also read `.claude/docs/ENGINEERING.md` and its **Pre-PR self-check**, as the agent file requires.

**Carry the marker into the PR (impl mode).** The cockpit re-reads it on the PR to decide stage 4, so the PR description must repeat it verbatim, directly under `Closes #N`:

```
Closes #503

> **SESSION REQUIRED:** touches `CLAUDE.md` / `.claude/**` — a dispatched agent can't edit those
```

Same literal string as the issue plan, same rendering — `.claude/docs/PIPELINE.md` → "Session-required tickets". **No label is involved on either surface.** Otherwise `gh pr create` is exactly as the agent file specifies:

```bash
gh pr create --repo SGAOperations/aplio \
  --base dev \
  --title "#<n> <Ticket Title In Title Case>" \
  --body-file .temp/pr-<n>.md \
  --assignee "<issue-assignee-login>" \
  --head <n>-ticket-name-in-kebab-case
```

## 6. Overrides

**This is the whole list. Anything not here applies unchanged** — if the agent files gain a rule that only makes sense for a subagent, it belongs here.

1. **`permissionMode: dontAsk` and "auto-denied silently"** — not your mode. Your session prompts normally.
2. **"STOP and emit `BLOCKED:`"** — pointless with a human present. Ask the operator directly (AskUserQuestion) and wait. Never emit a `BLOCKED:` sentinel, never guess.
3. **"Never spawn subagents"** — not applicable.
4. **The shell-allowlist discipline** (no `cat`/`grep`/`sed`/`find`, bare commands only, no `cd`, quoted cwd-relative paths) — that exists for the subagent's allowlist. Use whatever is clearest. **Still preferred:** `npm run …` over `npx …` for the toolchain, and `git rm` for tracked deletions.
5. **"You are already in a worktree; never run `git worktree`"** — inverted. You create the worktree (§4) and `cd` into it.
6. **Instruction files are read from the recorded main checkout** (§2), not the cwd — the worktree copy may be the thing you are editing.

## 7. Handoff

Per the agent file's own Handoff step:

- **impl** — issue `in progress` → `pr opened`; PR gets `ready for review`.
- **revise** — PR `revising` → `ready for review`.

The cockpit picks up review on its next tick. Finish by telling the operator the PR URL, the labels applied, and that `/worktree-clean` reclaims `.claude/worktrees/impl-<n>` once the PR merges.
