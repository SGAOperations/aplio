# Agent Pipeline

This repo uses a four-stage Claude Code skill pipeline to take GitHub Issues from ticket to merged PR.

## How to Use

1. Label the issue `claude` and `ready`
2. Run `/plan-agent <issue-number>` — writes the implementation plan into the issue
3. Review the plan; label the issue `plan approved` when satisfied
4. Run `/impl-agent <issue-number>` — creates a branch, implements the plan, opens a PR
5. Run `/review-agent <pr-number>` — reviews the diff and posts a structured comment on the PR
6. If the PR is labeled `needs revision`, run `/revise-agent <pr-number>` — fixes review findings and re-labels `ready for review`
7. Repeat steps 5–6 until the PR is labeled `approved`
8. Human reviews and merges

## Label Lifecycle

### Issue labels

| Label | Set by | Meaning |
|---|---|---|
| `claude` | Human | Claude is handling this ticket |
| `ready` | Human | Ready for plan agent |
| `plan approved` | Plan agent | Plan written; ready for implementation |
| `in progress` | Impl agent | Implementation underway |
| `pr opened` | Impl agent | PR has been opened |

### PR labels

| Label | Set by | Meaning |
|---|---|---|
| `ready for review` | Impl agent / Revise agent | Ready for review agent |
| `needs revision` | Review agent | Critical or Medium issues found |
| `approved` | Review agent | Only Low/Nit issues; ready to merge |

## Flow

```
[issue created]
      ↓  label: ready
/plan-agent <issue>  →  writes plan to issue  →  labels: plan approved
      ↓
/impl-agent <issue>  →  creates branch + PR   →  issue: pr opened | PR: ready for review
      ↓
/review-agent <pr>   →  posts review comment  →  PR: approved  OR  needs revision
      ↓ (if needs revision)
/revise-agent <pr>   →  fixes + pushes        →  PR: ready for review  (loops back to review)
      ↓ (if approved)
[human merges]
```

## Reading Current State

```bash
gh issue list --repo SGAOperations/aplio --label "ready"
gh issue list --repo SGAOperations/aplio --label "plan approved"
gh pr list --repo SGAOperations/aplio --label "ready for review"
gh pr list --repo SGAOperations/aplio --label "needs revision"
```

## Manual Intervention

If a stage fails midway:

- **Plan agent failed** — re-run `/plan-agent` if the `ready` label is still present; otherwise write the plan manually and label `plan approved`
- **Impl agent failed** — check if the branch exists (`git branch -a`), continue from the worktree or manually, then open the PR and apply labels
- **Review agent failed** — post the review comment manually and apply `needs revision` or `approved` to the PR
- **Revise agent failed** — push fixes manually, then apply `ready for review` to the PR
