import { invoke } from "@tauri-apps/api/core"
import { openUrl } from "@tauri-apps/plugin-opener"
import { check } from "@tauri-apps/plugin-updater"
import { relaunch } from "@tauri-apps/plugin-process"
import type { UpdateReadyPayload } from "../../shared/ipc"

export type { UpdateReadyPayload }

/** Working directory of the app process (replaces the old `cwd:get` IPC). */
export function getCwd(): Promise<string> {
  return invoke<string>("get_cwd")
}

/** Open an http(s) URL in the user's default browser. */
export async function openExternal(url: string): Promise<void> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error("invalid url")
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("only http(s) urls are allowed")
  }
  await openUrl(parsed.toString())
}

/** Tell the backend the main UI has mounted so it can reveal the window. */
export function notifyMainReady(): void {
  void invoke("notify_main_ready")
}

type ReadyCb = (info: UpdateReadyPayload) => void

let readyCb: ReadyCb | null = null
let installFn: (() => Promise<void>) | null = null

async function runCheck(): Promise<void> {
  try {
    const update = await check()
    if (!update) return
    // Download in the background, then surface the toast; install on click.
    await update.download()
    installFn = async () => {
      await update.install()
      await relaunch()
    }
    readyCb?.({ version: update.version })
  } catch (err) {
    console.error("[updater]", err)
  }
}

export const updater = {
  /** Subscribe to "an update is downloaded and ready". Returns an unsubscribe. */
  onReady(cb: ReadyCb): () => void {
    readyCb = cb
    void runCheck()
    return () => {
      if (readyCb === cb) readyCb = null
    }
  },
  /** Install the pending update and relaunch. */
  install(): void {
    if (installFn) void installFn()
  },
  /** Dev-only: simulate a ready update so the toast UI can be exercised. */
  fakeReady(version = "0.0.2-test"): void {
    installFn = async () => {
      console.info("[updater] fake install (dev) — no-op")
    }
    readyCb?.({ version })
  },
}
