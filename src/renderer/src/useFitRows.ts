import { useEffect, useState } from 'react'
import { fitRows, PAGE_SIZE } from './modListView'

//table border + footer (margin + height) + page bottom padding
const SPACE_BELOW_LIST = 1 + 12 + 34 + 24

export function useFitRows(): [number, (list: HTMLElement | null) => void] {
  const [list, setList] = useState<HTMLElement | null>(null)
  const [rows, setRows] = useState(PAGE_SIZE)

  useEffect(() => {
    const scroller = list?.closest('.content')
    const section = list?.closest('section')

    if (!list || !(scroller instanceof HTMLElement) || !section) return

    const observer = new ResizeObserver(() => {
      const top =
        list.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
      setRows(fitRows(scroller.clientHeight - top - SPACE_BELOW_LIST))
    })

    observer.observe(scroller)
    observer.observe(section)

    return () => observer.disconnect()
  }, [list])

  return [rows, setList]
}
