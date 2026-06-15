import { useEffect } from "react"
import { updater } from "@/lib/api"

export function DevHotkeys() {
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "u"
      ) {
        e.preventDefault()
        updater.fakeReady()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return null
}
