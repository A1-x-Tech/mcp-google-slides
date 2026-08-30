# Publishing & listing

How to release a new version and get listed in MCP catalogs so the server is
discoverable from Claude, Cursor, LobeHub and others. The canonical source is the
**official MCP registry** (`registry.modelcontextprotocol.io`).

## Version sync (important)

The version lives in **three places and must match byte-for-byte**:

- `package.json` → `version`;
- `server.json` → root `version`;
- `server.json` → `packages[0].version`.

And `mcpName` in `package.json` must equal `name` in `server.json`
(`io.github.A1-x-Tech/mcp-google-slides`). Check before publishing — all three must
print the same `X.Y.Z`:

```bash
grep -n '"version"' package.json server.json
```

> ⚠️ `mcp-publisher` publishes the **root** `server.json.version`. If you bump npm +
> `packages[0].version` but leave the root stale, `npm publish` still succeeds (it reads
> `package.json`), yet `mcp-publisher publish` fails with a misleading
> `400 cannot publish duplicate version` — it is re-publishing the old root version.

## Release (all channels in one go)

Publishing to npm alone silently drifts from the other channels: `git push --follow-tags`
pushes the tag but does **not** create a GitHub Release, and the registry is immutable per
version (even a metadata-only change needs a bump).

1. Bump `version` in the three places (see above) and update `CHANGELOG.md`
   (move `[Unreleased]` into a dated section).
2. `npm publish` — runs `typecheck` + `test` + `build` via `prepublishOnly` / `prepare`.
3. `git commit`, `git tag -a vX.Y.Z -m vX.Y.Z`, `git push origin main --follow-tags`.
4. **GitHub Release:** `gh release create vX.Y.Z --title vX.Y.Z --generate-notes --verify-tag`.
5. **Official MCP registry:**

```bash
brew install mcp-publisher                            # or a binary from modelcontextprotocol/registry releases
mcp-publisher logout                                  # login over a live token won't re-issue it
mcp-publisher login github --token "$(gh auth token)" # NOT the bare `login github` — see below
mcp-publisher publish                                 # from the repo root (where server.json lives)
```

> ⚠️ **Log in with a token, not the device flow.** `mcp-publisher login github` without
> `--token` authorizes the registry's OAuth app; an organization with "Only approved
> applications can access data" is invisible to it, so the registry sees no organizations and
> replies `403 Forbidden: You have permission to publish: io.github.<personal-login>/*`. The
> `gh` token already has the `read:org` scope and sees the organization.
>
> You can recognize it by the 403 text: it lists the available namespaces. If only the
> **personal** `io.github.<login>/*` shows up and no organization — it's the login method.
> Public membership is required but not sufficient; verify with
> `curl -s https://api.github.com/users/<login>/orgs` — it must show `A1-x-Tech`.

### What the registry verifies

- **Namespace** — the `io.github.A1-x-Tech/*` name is confirmed by logging in with a GitHub
  account that has access to the `A1-x-Tech` organization.
- **npm package ownership** — the published `package.json` must carry an `mcpName` equal to
  `name` in `server.json`. The package with that `mcpName` must already be on npm.

## LobeHub

1. Open [lobehub.com/mcp](https://lobehub.com/mcp) → **Submit MCP**.
2. Point it at `https://github.com/A1-x-Tech/mcp-google-slides`. LobeHub pulls the README,
   tool list and install config (`npx -y @a1-x-tech/mcp-google-slides`) automatically.
