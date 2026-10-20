@AGENTS.md

## Working with me

- **Deadline: 2026-10-20 14:00 UTC (17:00 Kyiv). No pushes or redeploys after that.** If something will take too long for the time left, say so and propose the simpler version.
- Never run `git commit` or `git push` yourself. When a chunk is ready: run tests and `npx tsc --noEmit`, give me a short summary of the changes, suggest a Conventional Commit message (see AGENTS.md), and wait for my ok. Suggest splitting if a change mixes things.
- If the last commit is ~30 min old (`git log -1 --format=%cr`), remind me to commit.
- Commit messages and PR texts contain only the message: no `Co-Authored-By`, no "Generated with" lines, no emoji or links.
- I keep `npx expo start --web` running in my own terminal. Don't start or restart it; tell me when a restart is needed. After each meaningful change, ask me to check it in the browser at ~390px. A step isn't done until I confirm.
- Before starting something new, tell me in a couple of lines what you're about to do.
- If the brief or API docs are ambiguous, ask instead of guessing; if I'm not around, pick the reasonable assumption, say it, and add it to NOTES.md.
- Prefer simple, working solutions over clever ones.

## Decisions (they're graded — never decide silently)

For each of these, give me **at least two approaches with trade-offs** and wait for my choice:
1. How amounts are represented and calculated.
2. What the balance shows right after a claim is submitted (users complained both about "didn't change, so I claimed again" and "dropped then jumped back").
3. What the user sees and the app does when a claim's result is unknown (e.g. timeout).

When I choose, add the decision, the alternatives and my reason to `NOTES.md` → Decisions.

## Being reviewable

- Point out risks in your own output (money math, race conditions, unknown claim states) instead of hiding them. If you're unsure something matches the API docs, say so.
- When I reject or change your suggestion, keep going with my version; don't re-argue unless there's a correctness issue.

## Tooling notes

- RN Claude Kit agents, skills and hooks are in `.claude/`. Useful here: `rn-reviewer` before each commit, `test-runner` for the amount tests, `dependency-auditor` before adding a library (**also check web support**).
- A hook blocks plain `npm install <pkg>`: use `npx expo install <pkg>` (dev deps: `npx expo install <pkg> -- --save-dev`).
- A hook asks before `git push`; the Stop hook reports new type errors, failing related tests and leftover `console.log`. If something it reports is intentional, say so and finish.
