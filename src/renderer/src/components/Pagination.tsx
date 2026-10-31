import { ChevronLeft, ChevronRight } from 'lucide-react'
import { pageNumbers } from '@renderer/modListView'
import './Pagination.css'

interface PaginationProps {
  page: number
  pageCount: number
  onChange: (page: number) => void
}

export function Pagination({ page, pageCount, onChange }: PaginationProps): React.JSX.Element {
  return (
    <nav className="pagination" aria-label="Pages">
      <button
        className="page-button"
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        aria-label="Previous page"
      >
        <ChevronLeft size={16} aria-hidden="true" />
      </button>
      {pageNumbers(page, pageCount).map((link, index) =>
        link === 'gap' ? (
          <span key={`gap-${index}`} className="page-gap" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={link}
            className={link === page ? 'page-button current' : 'page-button'}
            onClick={() => onChange(link)}
            aria-current={link === page ? 'page' : undefined}
          >
            {link}
          </button>
        )
      )}
      <button
        className="page-button"
        onClick={() => onChange(page + 1)}
        disabled={page === pageCount}
        aria-label="Next page"
      >
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </nav>
  )
}
