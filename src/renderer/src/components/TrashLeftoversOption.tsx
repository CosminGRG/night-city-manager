import './TrashLeftoversOption.css'

interface TrashLeftoverOptionProps {
  checked: boolean
  hint: string
  onChange: (checked: boolean) => void
}

export function TrashLeftoversOption({
  checked,
  hint,
  onChange
}: TrashLeftoverOptionProps): React.JSX.Element {
  return (
    <label className="confirm-option">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        Also move leftover files to the Recycle Bin
        <span className="muted">{hint}</span>
      </span>
    </label>
  )
}
