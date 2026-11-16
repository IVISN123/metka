import { PinGate } from './components/PinGate'
import { Shell } from './components/Shell'
import { AppState } from './components/state'

export default function App() {
  return (
    <AppState>
      <PinGate>
        <Shell />
      </PinGate>
    </AppState>
  )
}
