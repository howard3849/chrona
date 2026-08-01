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
6. stops if conflicting version references remain;
7. creates a root-level update ZIP in `release/` without `.git`.

To set an explicit version:

```bash
tools/finalize-release.command 2.1.19
```

Do not manually hard-code a version in `timeline.js`. It reads `window.CHRONA_VERSION` from generated `version.js`.
