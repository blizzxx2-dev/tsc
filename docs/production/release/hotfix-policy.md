# Hotfix policy

The demo hotfix service levels (D-0016, OPS-0129) are in [demo-release.md](demo-release.md#demo-hotfix-policy-ops-0129);
the 1.0 patch cadence (OPS-0142) is in [post-launch.md](post-launch.md#patch-cadence-ops-0142).
Common rules for any hotfix:
1. Branch from the released tag; fix + regression test; QA verifies on the `qa` branch.
2. Patch notes drafted with the fix (English), translated within 48 h (LOC-0104).
3. The previous public build stays on a hidden `rollback` branch until the next patch is stable for 72 h.
