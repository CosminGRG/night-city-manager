import { createElement, Fragment, type ReactNode } from 'react'

const PLACEHOLDER = /(\{\w+\})/

// Puts React elements into a translated text: insert('Type {word} to confirm', { word: <strong /> }).
// t() leaves placeholders it has no value for, so the text keeps {word} for this step.
export function insert(text: string, elements: Record<string, ReactNode>): ReactNode[] {
  return text.split(PLACEHOLDER).map((part, index) => {
    const name = part.slice(1, -1)
    const node = PLACEHOLDER.test(part) && Object.hasOwn(elements, name) ? elements[name] : part
    return createElement(Fragment, { key: index }, node)
  })
}
