export function Titlebar() {
  // Tauri's drag region attribute replaces Electron's `-webkit-app-region`.
  return <div className="h-10 shrink-0 bg-transparent" data-tauri-drag-region />
}
