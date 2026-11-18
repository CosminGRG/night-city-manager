import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { insert } from './insert'

function html(text: string, elements: Record<string, React.ReactNode>): string {
  return renderToStaticMarkup(createElement('p', null, ...insert(text, elements)))
}

describe('insert', () => {
  it('puts an element where its placeholder is, in any position', () => {
    const word = createElement('strong', null, 'remove')

    expect(html('Type {word} to confirm', { word })).toBe(
      '<p>Type <strong>remove</strong> to confirm</p>'
    )
    expect(html('{word} eingeben', { word })).toBe('<p><strong>remove</strong> eingeben</p>')
  })

  it('leaves unknown placeholders as text', () => {
    expect(html('Type {other}', {})).toBe('<p>Type {other}</p>')
  })
})
