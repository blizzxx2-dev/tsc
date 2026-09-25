# Test quarantine (QAT-0015)

A test that passes only on retry is **flaky**. CI (two retries for E2E/visual) reports it in the job summary and
`scripts/qa/file-flaky.mjs` opens or updates a GitHub issue labelled `flaky` on main and in the nightly run.

Policy:

1. The owner of the area fixes the test (or the product bug it exposes) within **2 weeks** of the issue opening.
2. If it cannot be fixed at once and it blocks merges, quarantine it: add a row below and change it to
   `it.skip(...)` with the issue link in a comment on the line above — the `qa/skip-needs-issue` lint rule rejects
   a skip without one.
3. At the deadline the test is either fixed and un-skipped, or deleted with a replacement test named in the issue.
4. QA reviews this table at every triage; anything past its deadline becomes an S3 bug against the area.

| Test (file › name) | Issue | Quarantined on | Fix by | Owner |
|---|---|---|---|---|
| _none_ | | | | |
