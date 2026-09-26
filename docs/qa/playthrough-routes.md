# Full-campaign playthrough routes (CON-0253)

Four QA routes, one per ending. Each lists the choices and results that decide the ending, and the
dev-console `flag` lines that set the same state for a quick run from Chapter V (`chapter 5`, then
`flag …` for each line, then `op op5-9` for the finale). The ending rule is `endingFor` in
`src/content/endings.ts`; `tests/unit/content/routes.test.ts` checks that every route below reaches
its ending.

Stroh's trust counts: the cantor kept awake (+1), a true certificate (+1; the kind lie −2), his
tooth out (+1, +1 more at S or better), von Salm burned as dead (+1), the Litany owned at the trial
(+1), and −1 for every two operations won with the Litany. The Whisper is the Litany count, +2 for
the lie on the certificate: 5 or more is *Accused*.

## Route 1 — The pardon

| Where | Do | Flag |
| --- | --- | --- |
| s2-4 | Keep the cantor awake for Stroh | `flag cantorMercy false` |
| s3-2 | Certify Liesl truthfully: turned | `flag hornchildCertificate turned` |
| op3-9 | Draw Stroh's molar | `flag strohTooth true` |
| — | Never speak the Litany in an operation | `flag litanySeenCount 0` |

Trust 3, Whisper unremarked → **pardon** (Stroh signs it).

## Route 2 — The pyre, stayed

| Where | Do | Flag |
| --- | --- | --- |
| s2-4 | Give the cantor poppy | `flag cantorMercy true` |
| s3-2 | Certify Liesl as natural (the kind lie) | `flag hornchildCertificate natural` |
| op4-7 | Win the Hour of Sext at B or better | `flag mauerFate hale` |
| — | Speak the Litany twice at most | `flag litanySeenCount 2` |

Trust −3, Whisper 4 (suspected) and Mauer hale → **pyre**, stayed by the Watch.

## Route 3 — Exile

| Where | Do | Flag |
| --- | --- | --- |
| s2-4 | Give the cantor poppy | `flag cantorMercy true` |
| s3-2 | Certify Liesl as natural | `flag hornchildCertificate natural` |
| op4-7 | Lose Mauer's hand (below B) | `flag mauerFate maimed` |
| op3-11 | Haller scarred (below S) | `flag hallerFate scarred` |
| — | Speak the Litany in four operations | `flag litanySeenCount 4` |

Trust −4, Whisper 6 (accused), nobody stands up → **exile** with Ilse.

## Route 4 — The Perfect End

Any flags. Lose the finale, op5-9 (`op op5-9`, then `lose`): the Office completes and the city
sleeps. The journal page is the Perfect End's.

## After each route

Check the credits roll, the post-credits scene sets `unsungHeard` (full edition), and the Trials
board's *The Unsung Hour* opens.
