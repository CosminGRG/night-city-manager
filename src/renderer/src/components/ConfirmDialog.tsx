import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { useT } from '@renderer/i18n/context'
import './ConfirmDialog.css'

interface ConfirmDialogProps {
  title: string
  confirmLabel: string
  tone?: 'danger' | 'primary'
  confirmDisabled?: boolean
  initialFocus?: React.RefObject<HTMLElement | null>
  children: React.ReactNode
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({
  title,
  confirmLabel,
  tone = 'danger',
  confirmDisabled,
  initialFocus,
  children,
  onConfirm,
  onClose
}: ConfirmDialogProps): React.JSX.Element {
  const t = useT()

  return (
    <AlertDialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="dialog-overlay" />
        <AlertDialog.Content
          className="dialog"
          onOpenAutoFocus={(event) => {
            if (!initialFocus?.current) return
            event.preventDefault()
            initialFocus.current.focus()
          }}
        >
          <AlertDialog.Title className="dialog-title">{title}</AlertDialog.Title>
          <AlertDialog.Description asChild>
            <div className="dialog-body">{children}</div>
          </AlertDialog.Description>
          <div className="dialog-actions">
            <AlertDialog.Cancel asChild>
              <button>{t('common.cancel')}</button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button className={tone} disabled={confirmDisabled} onClick={onConfirm}>
                {confirmLabel}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
