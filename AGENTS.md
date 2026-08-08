# Agent Operating Rules

## Source control and hosting
- GitHub is source control only for this project. Do not use GitHub Pages.
- Cloudflare Pages is the deployment platform.
- `main` is the stable production/public branch.
- `dev` is the active development branch.
- Normal coding work must happen on `dev`, not directly on `main`, unless Howard explicitly instructs otherwise.

## Development cycle
1. Begin a cycle with `dev` aligned to the current approved `main` state.
2. Implement and iterate on `dev` for as long as needed.
3. Push `dev` regularly so the Cloudflare development/preview deployment stays current.
4. Keep `main` unchanged while development is in progress.
5. When Howard declares the `dev` build stable and release-ready, promote the approved `dev` state to `main`.
6. Push `main`; Cloudflare production should deploy from `main`.
7. Continue the next development cycle on `dev`.

## Release semantics
- Treat `dev` as the authoritative candidate for the next release.
- `main` is the publication slot for the last approved stable release.
- There is normally nothing unique on `main` that should override approved `dev` work.
- When release-ready, make `main` match the approved `dev` state rather than preserving unwanted divergence.

## Deployment URLs
- Production and development URLs must coexist.
- The production URL must always represent `main`.
- The development/preview URL must always represent the latest `dev` deployment.
- Never switch the production URL to point at `dev`.
- Record actual Cloudflare project and URL details in `docs/DEPLOYMENT.md`.

## Working cadence
- Prefer substantial batches of related implementation work on `dev`.
- Do not stop after every small change for approval.
- Use the development deployment for iterative testing.
- Do not publish unfinished work to `main` without explicit release approval.

## Documentation authority
- This file defines the repository workflow that coding agents must follow.
- `docs/DEPLOYMENT.md` contains project-specific deployment details.
- If older documentation mentions GitHub Pages, treat it as obsolete and update it when touched.
