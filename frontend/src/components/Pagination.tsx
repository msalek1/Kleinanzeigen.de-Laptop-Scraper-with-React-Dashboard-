import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PaginationInfo } from '../services/api'
import { motion } from 'framer-motion'

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
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="flex flex-col sm:flex-row items-center justify-between mt-12 gap-4 border-t border-gray-200 dark:border-gray-800 pt-6"
    >
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
        Page <span className="text-gray-900 dark:text-white">{page}</span> of {total_pages} <span className="text-gray-300 mx-1">|</span> {total_items} results
      </p>
      
      <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-1 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <motion.button
          whileHover={{ scale: 1.05, backgroundColor: "rgba(0,0,0,0.05)" }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onPageChange(page - 1)}
          disabled={!has_prev}
          className="p-2 rounded-xl text-gray-600 dark:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-5 h-5" />
        </motion.button>
        
        <div className="flex items-center px-2 gap-1">
            {getPageNumbers().map((pageNum, idx) => (
            pageNum === 'ellipsis' ? (
                <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">...</span>
            ) : (
                <motion.button
                    key={pageNum}
                    onClick={() => onPageChange(pageNum)}
                    className={`relative w-9 h-9 rounded-lg text-sm font-semibold transition-colors z-10 ${
                        pageNum === page
                        ? 'text-white'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                >
                    {pageNum === page && (
                        <motion.div
                            layoutId="pagination-active"
                            className="absolute inset-0 bg-primary-600 rounded-lg -z-10 shadow-lg shadow-primary-500/30"
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        />
                    )}
                    {pageNum}
                </motion.button>
            )
            ))}
        </div>
        
        <motion.button
          whileHover={{ scale: 1.05, backgroundColor: "rgba(0,0,0,0.05)" }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onPageChange(page + 1)}
          disabled={!has_next}
          className="p-2 rounded-xl text-gray-600 dark:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-5 h-5" />
        </motion.button>
      </div>
    </motion.div>
  )
}
