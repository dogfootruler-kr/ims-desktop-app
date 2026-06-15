# Project rules

## Stack

- **Tauri v2** — Rust backend (`src-tauri/`) hosting the OS WebView (WKWebView on
  macOS). No bundled Chromium.
- **React 19** in the renderer, built with **Vite**. **TailwindCSS 4** via `@tailwindcss/vite`.
- Tauri bundler for packaging. **`tauri-plugin-updater`** for auto-updates against GitHub Releases.

## Layout

```
src/
├── shared/      # TS payload types shared by backend + renderer
└── renderer/    # React app (Vite root)
    ├── lib/     # api.ts — typed bridge to Tauri commands + plugins
    └── splash/  # Standalone splash page (Canvas 2D line field, no React)
src-tauri/       # Rust crate: window orchestration, commands, plugins, bundler config
├── src/lib.rs   # run(): plugins, commands (get_cwd, notify_main_ready), setup
├── tauri.conf.json
└── capabilities/default.json   # permission grants per window
```

## Rules

- Never use `any` (TS) — the renderer talks to the backend only through
  `src/renderer/lib/api.ts`, never via a raw `window` global.
- One component per file.
- Renderer never imports from `electron`/native APIs directly — only through
  `@tauri-apps/api`, the official plugins, or `src/renderer/lib/api.ts`.
- New backend calls: add a `#[tauri::command]` in `src-tauri/src/lib.rs`,
  register it in `generate_handler!`, grant any plugin permission in
  `src-tauri/capabilities/default.json`, then wrap it in `src/renderer/lib/api.ts`
  (with a shared payload type in `src/shared/ipc.ts` if needed).
- Run `pnpm typecheck` (and, for backend changes, `cargo check` in `src-tauri/`)
  before declaring work complete.

## Scripts

| Command          | Purpose                                                    |
| ---------------- | ---------------------------------------------------------- |
| `pnpm dev`       | `tauri dev` — Vite HMR renderer + Rust backend auto-build. |
| `pnpm build`     | `tauri build` — bundle signed `.app`/`.dmg`.               |
| `pnpm dev:vite`  | Renderer dev server only (invoked by Tauri's dev hook).    |
| `pnpm typecheck` | `tsc --noEmit` for the renderer/web config.                |
| `pnpm tauri`     | Raw Tauri CLI passthrough (e.g. `pnpm tauri icon`).        |

## Code signing / notarization

`pnpm build` reads these env vars automatically:

- `APPLE_CERTIFICATE` — base64 of the Developer ID `.p12` cert (or `APPLE_SIGNING_IDENTITY`)
- `APPLE_CERTIFICATE_PASSWORD` — password for that cert
- `APPLE_ID`, `APPLE_PASSWORD` (app-specific), `APPLE_TEAM_ID` — notarization

Auto-update artifacts must be signed with the Tauri updater key:

- `TAURI_SIGNING_PRIVATE_KEY` — minisign private key (generated via `pnpm tauri signer generate`)
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — its password

The matching public key lives in `tauri.conf.json` → `plugins.updater.pubkey`.

## Releasing (CI)

`.github/workflows/release.yml` builds macOS (Apple Silicon + Intel), Windows,
and Linux via `tauri-apps/tauri-action`. Push a version tag to trigger it:

```
git tag v0.0.2 && git push origin v0.0.2
```

It creates a **draft** GitHub Release with all installers plus the signed
`latest.json` (the auto-updater endpoint). Review, then publish — the updater's
`releases/latest/download/latest.json` URL only resolves once published.

Required repository secrets (Settings → Secrets and variables → Actions):

| Secret | Purpose |
| ------ | ------- |
| `TAURI_SIGNING_PRIVATE_KEY` | minisign private key (contents of the key file) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | its password (omit if the key has none) |
| `APPLE_CERTIFICATE` / `APPLE_CERTIFICATE_PASSWORD` | base64 Developer ID `.p12` + password |
| `APPLE_SIGNING_IDENTITY` | e.g. `Developer ID Application: … (TEAMID)` |
| `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID` | notarization |

The Apple secrets only affect the macOS jobs; Windows/Linux build without them.
By default the workflow's Apple block is **commented out**, so macOS ships
**unsigned**. To enable signing, set the Apple secrets and uncomment that block
in `.github/workflows/release.yml` — but never leave the vars as empty strings
(an empty `APPLE_CERTIFICATE` makes tauri attempt and fail a cert import).

## userEmail

The user's email address is patrice@dnk.co.
