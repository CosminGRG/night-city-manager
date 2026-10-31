import * as AlertDialog from '@radix-ui/react-alert-dialog'
import './ConfirmDialog.css'

interface ConfirmDialogProps {
  title: string
  confirmLabel: string
  children: React.ReactNode
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({
  title,
  confirmLabel,
  children,
  onConfirm,
  onClose
}: ConfirmDialogProps): React.JSX.Element {
  return (
    <AlertDialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="dialog-overlay" />
        <AlertDialog.Content className="dialog">
          <AlertDialog.Title className="dialog-title">{title}</AlertDialog.Title>
          <AlertDialog.Description asChild>
            <div className="dialog-body">{children}</div>
          </AlertDialog.Description>
          <div className="dialog-actions">
            <AlertDialog.Cancel asChild>
              <button>Cancel</button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button className="danger" onClick={onConfirm}>
                {confirmLabel}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
