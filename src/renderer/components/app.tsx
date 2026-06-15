import { Titlebar } from "./titlebar"
import { Home } from "./home"
import { UpdateToast } from "./update-toast"
import { DevHotkeys } from "./dev-hotkeys"

export function App() {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <Home />
      <div className="absolute inset-x-0 top-0 z-10">
        <Titlebar />
      </div>
      <UpdateToast />
      <DevHotkeys />
    </div>
  )
}
