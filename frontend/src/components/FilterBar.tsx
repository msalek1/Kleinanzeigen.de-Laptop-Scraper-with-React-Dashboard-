import { useState, useCallback } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { ListingsParams } from '../services/api'
import { motion, AnimatePresence } from 'framer-motion'

interface FilterBarProps {
  filters: ListingsParams
  onFilterChange: (filters: ListingsParams) => void
}

/**
 * Filter bar component for searching and filtering listings.
 * Supports text search, price range, location, and sorting.
 */
export default function FilterBar({ filters, onFilterChange }: FilterBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [searchText, setSearchText] = useState(filters.q || '')
  
  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    onFilterChange({ ...filters, q: searchText, page: 1 })
  }, [filters, searchText, onFilterChange])
  
  const handleFilterChange = useCallback((key: keyof ListingsParams, value: string | number | undefined) => {
    const newFilters = { ...filters, [key]: value, page: 1 }
    if (value === '' || value === undefined) {
      delete newFilters[key]
    }
    onFilterChange(newFilters)
  }, [filters, onFilterChange])
  
  const clearFilters = useCallback(() => {
    setSearchText('')
    onFilterChange({ page: 1, per_page: filters.per_page })
  }, [filters.per_page, onFilterChange])
  
  const hasActiveFilters = filters.q || filters.min_price || filters.max_price || filters.location || filters.condition
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6 transition-all duration-300 hover:shadow-md">
      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search notebooks..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          />
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium shadow-sm hover:shadow"
        >
          Search
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`px-3 py-2 border rounded-lg transition-colors ${
            showAdvanced || hasActiveFilters
              ? 'border-primary-500 text-primary-600 bg-primary-50 dark:bg-primary-900/20'
              : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          <SlidersHorizontal className="w-5 h-5" />
        </motion.button>
      </form>
      
      {/* Advanced filters */}
      <AnimatePresence>
        {showAdvanced && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="pt-4 mt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Price range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Min Price (€)
                  </label>
                  <input
                    type="number"
                    value={filters.min_price || ''}
                    onChange={(e) => handleFilterChange('min_price', e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="0"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Max Price (€)
                  </label>
                  <input
                    type="number"
                    value={filters.max_price || ''}
                    onChange={(e) => handleFilterChange('max_price', e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="10000"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  />
                </div>
                
                {/* Location */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Location
                  </label>
                  <input
                    type="text"
                    value={filters.location || ''}
                    onChange={(e) => handleFilterChange('location', e.target.value || undefined)}
                    placeholder="City name..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  />
                </div>
                
                {/* Condition */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Condition
                  </label>
                  <select
                    value={filters.condition || ''}
                    onChange={(e) => handleFilterChange('condition', e.target.value || undefined)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  >
                    <option value="">Any</option>
                    <option value="Neu">New</option>
                    <option value="Gebraucht">Used</option>
                  </select>
                </div>
              </div>
              
              {/* Sort options */}
              <div className="mt-5 flex flex-wrap gap-4 items-center justify-between">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Sort by:
                  </label>
                  <select
                    value={filters.sort || 'scraped_at'}
                    onChange={(e) => handleFilterChange('sort', e.target.value as ListingsParams['sort'])}
                    className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="scraped_at">Recently Added</option>
                    <option value="posted_at">Posted Date</option>
                    <option value="price">Price</option>
                    <option value="title">Title</option>
                  </select>
                  <select
                    value={filters.order || 'desc'}
                    onChange={(e) => handleFilterChange('order', e.target.value as 'asc' | 'desc')}
                    className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="desc">Descending</option>
                    <option value="asc">Ascending</option>
                  </select>
                </div>
                
                {hasActiveFilters && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={clearFilters}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 rounded-lg transition-colors font-medium"
                  >
                    <X className="w-4 h-4" />
                    Clear Filters
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
