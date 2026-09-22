# Hard Won Lessons

**What the critic teaches Claude.** The mentor coaches the person asking; this file is the other
half — the findings from past reviews, read back at the start of every session so a fault named
once is not met fresh next time.

**Newest first. Append-only.** A lesson that turned out wrong is evidence about the reviewer and
stays on the record; write a newer lesson that corrects it rather than editing the old one.

**Every line here is read into every session, so keep them short and imperative.** If it needs a
paragraph of context it is not a lesson yet — it is a verdict, and verdicts live in the reviews file.

---

## Never report a pipeline's success from a piped command — sed swallows the exit code of what came before it.
_Critic review 3 · 2026-09-22_

## When a check surprises you, update the document it contradicts in the same commit.
The install test disproved the README's 'nobody has installed this' and left it standing in a public repo.
_Critic review 3 · 2026-09-22_

## A check that passes on empty input has not run. Assert the input is non-empty before trusting a green result.
A README file-map verifier reported ok thirteen times against stripped-empty strings.
_Critic review 3 · 2026-09-22_

