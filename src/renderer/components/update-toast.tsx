import { useEffect, useState } from "react"
import { updater } from "@/lib/api"

export function UpdateToast() {
  const [version, setVersion] = useState<string | null>(null)

  useEffect(() => {
    return updater.onReady(({ version: v }) => {
      setVersion(v)
    })
  }, [])

  if (!version) return null

  return (
    <button
      type="button"
      onClick={() => updater.install()}
      className="absolute bottom-6 right-1/2 translate-x-1/2 z-20 group flex items-center gap-3 rounded-full border border-white/10 bg-black/55 px-4 py-2 backdrop-blur-md transition-colors hover:bg-black/70 hover:border-white/20"
      style={{ pointerEvents: "auto" }}
    >
      <span className="font-mono text-[9px] uppercase tracking-[0.35em] text-white/55">
        update
      </span>
      <span className="font-mono text-[11px] text-white/85">v{version}</span>
      <span className="font-mono text-[9px] uppercase tracking-[0.35em] text-white/70 group-hover:text-white">
        click to install →
      </span>
    </button>
  )
}
