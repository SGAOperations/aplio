---
name: scope
description: Stage 0 — interactive decomposition of a major feature into an epic with sub-issues before any per-ticket planning. Run on the session model (opus/fable recommended). Usage: /scope <feature description>
allowed-tools: Bash(gh issue create *) Bash(gh issue view *) Bash(gh issue edit *) Bash(gh api repos/SGAOperations/aplio/*) Bash(gh api graphql *)
---

# Scope — Stage 0: Epic Decomposition

**Trigger:** Manual — a human wants to break a major feature into tickets before planning
**Input:** `$ARGUMENTS` — a feature description (may be rough)
**Model:** inherits the session — run on opus/fable for big features; this is the highest-leverage thinking in the pipeline

Small bug fixes and single-scope tickets do NOT need this stage — file an issue and opt it in via `/pipeline` directly.

## 1. Brainstorm

This is a conversation, not a form. Ask **one question at a time**, multiple choice where possible, until you understand:

- **Purpose** — what user/business problem this solves; what done looks like
- **Constraints** — schema implications, auth/roles affected, existing features it must not break
- **Success criteria** — how a human verifies the feature works
- **Decomposition** — independently shippable sub-tickets, each one PR-sized, ordered by dependency

Read `.claude/docs/ENGINEERING.md` and the relevant parts of the codebase as needed so the decomposition reflects how this app is actually built (server components, services in `prisma/services/`, etc.).

## 2. Present the breakdown — get approval before creating anything

Show: the epic summary, the list of sub-tickets (title + 2–3 sentence scope each), and the dependency order. Iterate until the human approves. Do not create any issues before approval.

## 3. Create the issues

Create the parent epic, then each sub-issue:

```bash
gh issue create --repo SGAOperations/aplio --title "<Epic Title>" --body "<epic summary, goals, success criteria, list of sub-tickets>"
gh issue create --repo SGAOperations/aplio --title "<Sub-Ticket Title>" --body "<scope, acceptance criteria, relevant files/constraints discovered during brainstorming>"
```

Link each child to the epic (REST, database `id` — not the issue number):

```bash
# Get the database ID of the child issue
gh api repos/SGAOperations/aplio/issues/<child-number> --jq '.id'

# Add it as a sub-issue of the epic
gh api repos/SGAOperations/aplio/issues/<epic-number>/sub_issues -X POST --input - <<'EOF'
{"sub_issue_id": <database-id>}
EOF
```

Where order matters, add blocked-by relationships (GraphQL, node IDs):

```bash
# Get node IDs
gh api repos/SGAOperations/aplio/issues/<number> --jq '.node_id'

# issueId = the blocked issue, blockingIssueId = the blocker
gh api graphql -f query='mutation { addBlockedBy(input: { issueId: "BLOCKED_NODE_ID", blockingIssueId: "BLOCKER_NODE_ID" }) { clientMutationId } }'
```

## 4. Hand back

List the created issue numbers (epic + sub-tickets, with dependency order). Remind the human:

> Nothing is opted in yet — in `/pipeline`, say "work on #N" to start a sub-ticket. The cockpit will warn if its blockers aren't merged.
