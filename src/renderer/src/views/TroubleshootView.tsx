import { LeftoversPanel } from '@renderer/components/LeftoversPanel'
import './TroubleshootView.css'

export function TroubleshootView(): React.JSX.Element {
  return (
    <section className="troubleshoot">
      <h2>Troubleshoot</h2>
      <LeftoversPanel />
    </section>
  )
}
