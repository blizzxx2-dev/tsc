# Independent-creation archive (OPS-0055)

Purpose: evidence that *Suture & Steel* was created independently — dated design documents, research
notes that show deliberate distance from other IP (`docs/research/`), sketches, story drafts and the
full commit history — so a copying claim can be rebutted.

## Procedure (Producer, at every milestone gate: M0, Demo, Alpha, Beta, Release)
1. `node scripts/ops/archive-snapshot.mjs <gate>` → `archive/<date>-<gate>/` with `repo.bundle`
   (full git history), `docs.tar.gz` (docs + sketches + story drafts) and `MANIFEST.sha256` (hashes,
   HEAD commit, timestamp).
2. Upload the folder to **write-once storage**: an object-storage bucket with Object Lock in
   *compliance* mode (retention 10 years) or an equivalent WORM archive service. Two people hold access.
3. Optionally timestamp `MANIFEST.sha256` with an RFC 3161 time-stamping authority and store the token
   next to it.
4. Record in the table below.

| Gate | Date | HEAD commit | Storage location / object key | Retention until | By |
|---|---|---|---|---|---|
| M0 | | | | | |

Sketches and story drafts kept outside git (paper, drawing apps) are scanned/exported into `sketches/`
or `story-drafts/` before each snapshot so the script picks them up.
