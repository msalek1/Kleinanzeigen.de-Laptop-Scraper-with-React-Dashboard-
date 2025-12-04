import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PaginationInfo } from '../services/api'

interface PaginationProps {
  pagination: PaginationInfo
  onPageChange: (page: number) => void
}

/**
 * Pagination component for navigating through pages of listings.
 */
export default function Pagination({ pagination, onPageChange }: PaginationProps) {
  const { page, total_pages, total_items, has_prev, has_next } = pagination
  
  if (total_pages <= 1) return null
  
  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = []
    const showPages = 5
    
    let start = Math.max(1, page - Math.floor(showPages / 2))
    const end = Math.min(total_pages, start + showPages - 1)
    
    if (end - start + 1 < showPages) {
      start = Math.max(1, end - showPages + 1)
    }
    
    if (start > 1) {
      pages.push(1)
      if (start > 2) pages.push('ellipsis')
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i)
    }
    
    if (end < total_pages) {
      if (end < total_pages - 1) pages.push('ellipsis')
      pages.push(total_pages)
    }
    
    return pages
  }
  
  return (
    <div className="flex items-center justify-between mt-8">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Showing page {page} of {total_pages} ({total_items} total listings)
      </p>
      
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={!has_prev}
          className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        
        {getPageNumbers().map((pageNum, idx) => (
          pageNum === 'ellipsis' ? (
            <span key={`ellipsis-${idx}`} className="px-2 text-gray-500">...</span>
          ) : (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              className={`min-w-[40px] h-10 rounded-lg font-medium transition-colors ${
                pageNum === page
                  ? 'bg-primary-600 text-white'
                  : 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {pageNum}
            </button>
          )
        ))}
        
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={!has_next}
          className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
