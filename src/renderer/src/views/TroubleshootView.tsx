import { useState } from 'react'
import { LeftoversPanel } from '@renderer/components/LeftoversPanel'
import { BisectPanel } from '@renderer/components/BisectPanel'
import './TroubleshootView.css'

export function TroubleshootView(): React.JSX.Element {
  const [bisecting, setBisecting] = useState(false)

  return (
    <section className="troubleshoot">
      <h2>Troubleshoot</h2>
      <BisectPanel onRunningChange={setBisecting} />
      <LeftoversPanel locked={bisecting} />
    </section>
  )
}
