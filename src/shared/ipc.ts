// Types shared between the Tauri backend (src-tauri) and the renderer.
// IPC routing itself lives in `src/renderer/lib/api.ts` (Tauri commands +
// plugins); this file only carries the payload shapes.

export type UpdateReadyPayload = { version: string }
