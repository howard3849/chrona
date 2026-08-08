# Chrona Deployment

## Platform
- Source repository: GitHub
- Hosting: Cloudflare Pages
- GitHub Pages: not used

## Branches
- Production: `main`
- Development: `dev`

## Deployment behavior
- Cloudflare production must deploy from `main`.
- Cloudflare preview/development must deploy from `dev`.
- Both URLs should remain live at the same time.
- Testers receive the production URL unless Howard explicitly wants them testing the development build.
- Howard uses the development URL for work-in-progress testing.

## Release procedure
1. Develop and test on `dev`.
2. Leave `main` frozen during the development cycle.
3. When Howard approves the build for release, promote the approved `dev` state so `main` matches it.
4. Push/update `main` and allow Cloudflare to publish the production deployment.
5. Continue subsequent development on `dev`.

## Cloudflare project details
Record these after the Cloudflare Pages project is connected:

- Cloudflare Pages project name: `TBD`
- Production URL: `TBD`
- Development/preview URL: `TBD`
- Custom production domain: `TBD`
- Custom development domain: `TBD`

Do not guess these values. Update this file once the Cloudflare deployment exists.
