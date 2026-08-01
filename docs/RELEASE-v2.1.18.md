# Chrona v2.1.18

This release introduces a single-source versioning and release-finalization mechanism.

- `VERSION` is the authoritative human-readable version.
- `version.js` is generated from `VERSION` and supplies the runtime version.
- `timeline.js` no longer hard-codes a numeric application version.
- `tools/finalize-release.command` automatically bumps/synchronizes/verifies the version and packages a repo-safe update ZIP.
- Release ZIPs place project files at the ZIP root and exclude `.git`.
