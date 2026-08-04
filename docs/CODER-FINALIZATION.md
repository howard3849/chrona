# Chrona coding-session finalization

Every code-generation session must end by running:

```bash
tools/finalize-release.command
```

The command automatically:

1. increments the patch version in `VERSION` (or accepts an explicit version argument);
2. regenerates `version.js`, the runtime version source of truth;
3. updates the version shown in Settings;
4. updates every CSS/JavaScript `?v=` cache key in `index.html`;
5. checks JavaScript syntax when Node is installed;
6. verifies that `README.md` contains the new version-history entry;
7. verifies that `docs/RELEASE-vX.Y.Z.md` exists;
8. stops if conflicting version references remain;
9. creates a root-level update ZIP in `release/` without `.git`.

To set an explicit version:

```bash
tools/finalize-release.command 2.1.19
```

Do not manually hard-code a version in `timeline.js`. It reads `window.CHRONA_VERSION` from generated `version.js`.


Before finalization, update `README.md` with a concise entry for the new version, newest first. Use a paragraph for simple changes and bullets for complex design or architecture work.
