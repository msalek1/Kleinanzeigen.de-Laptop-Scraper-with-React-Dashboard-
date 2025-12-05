import { useState, useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { RefreshCw, Loader2, AlertCircle, Tag, X } from 'lucide-react'
import { useListings, useTriggerScraper, useKeywords } from '../hooks/useApi'
import { ListingsParams } from '../services/api'
import FilterBar from '../components/FilterBar'
import ListingGrid from '../components/ListingGrid'
import Pagination from '../components/Pagination'
import StatsPanel from '../components/StatsPanel'

/**
 * Home page displaying the main listings view with filters.
 * Supports URL query params for shareable filter states.
 */
export default function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  
  // Parse filters from URL
  const getFiltersFromUrl = useCallback((): ListingsParams => {
    const params: ListingsParams = {
      page: parseInt(searchParams.get('page') || '1'),
      per_page: parseInt(searchParams.get('per_page') || '20'),
    }
    
    const q = searchParams.get('q')
    if (q) params.q = q
    
    const minPrice = searchParams.get('min_price')
    if (minPrice) params.min_price = parseFloat(minPrice)
    
    const maxPrice = searchParams.get('max_price')
    if (maxPrice) params.max_price = parseFloat(maxPrice)
    
    const location = searchParams.get('location')
    if (location) params.location = location
    
    const condition = searchParams.get('condition')
    if (condition) params.condition = condition
    
    const keyword = searchParams.get('keyword')
    if (keyword) params.keyword = keyword
    
    const sort = searchParams.get('sort') as ListingsParams['sort']
    if (sort) params.sort = sort
    
    const order = searchParams.get('order') as 'asc' | 'desc'
    if (order) params.order = order
    
    return params
  }, [searchParams])
  
  const [filters, setFilters] = useState<ListingsParams>(getFiltersFromUrl)
  
  // Update URL when filters change
  const handleFilterChange = useCallback((newFilters: ListingsParams) => {
    setFilters(newFilters)
    
    const params = new URLSearchParams()
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.set(key, String(value))
      }
    })
    setSearchParams(params)
  }, [setSearchParams])
  
  // Sync from URL on navigation
  useEffect(() => {
    setFilters(getFiltersFromUrl())
  }, [searchParams, getFiltersFromUrl])
  
  // Fetch listings
  const { data, isLoading, error, refetch } = useListings(filters)
  
  // Fetch keywords for filter tags
  const { data: keywordsData } = useKeywords()
  
  // Scraper trigger
  const triggerScraper = useTriggerScraper()
  
  const handleTriggerScrape = useCallback(async () => {
    try {
      await triggerScraper.mutateAsync({ page_limit: 3 })
    } catch (err) {
      console.error('Failed to trigger scraper:', err)
    }
  }, [triggerScraper])
  
  const handlePageChange = useCallback((page: number) => {
    handleFilterChange({ ...filters, page })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [filters, handleFilterChange])
  
  const handleKeywordClick = useCallback((keyword: string) => {
    // If clicking the already-selected keyword, clear it
    if (filters.keyword === keyword) {
      const { keyword: _, ...rest } = filters
      handleFilterChange({ ...rest, page: 1 })
    } else {
      handleFilterChange({ ...filters, keyword, page: 1 })
    }
  }, [filters, handleFilterChange])
  
  const handleClearKeyword = useCallback(() => {
    const { keyword: _, ...rest } = filters
    handleFilterChange({ ...rest, page: 1 })
  }, [filters, handleFilterChange])
  
  const showStats = searchParams.get('view') === 'stats'
  
  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Notebook Listings
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Browse and search notebook listings from Kleinanzeigen
          </p>
        </div>
        
        <button
          onClick={handleTriggerScrape}
          disabled={triggerScraper.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {triggerScraper.isPending ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Scraping...
            </>
          ) : (
            <>
              <RefreshCw className="w-5 h-5" />
              Scrape New Listings
            </>
          )}
        </button>
      </div>
      
      {/* Success/error messages */}
      {triggerScraper.isSuccess && (
        <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400">
          ✅ {triggerScraper.data.message || 'Scraping completed successfully!'}
        </div>
      )}
      
      {triggerScraper.isError && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Failed to trigger scraper. Please try again later.
        </div>
      )}
      
      {/* Stats panel (conditional) */}
      {showStats && <StatsPanel />}
      
      {/* Keyword filter tags */}
      {keywordsData?.data && keywordsData.data.length > 0 && (
        <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <Tag className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Filter by search keyword:
            </span>
            {filters.keyword && (
              <button
                onClick={handleClearKeyword}
                className="ml-auto text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Clear filter
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {keywordsData.data.map(({ keyword, count }) => (
              <button
                key={keyword}
                onClick={() => handleKeywordClick(keyword)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filters.keyword === keyword
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {keyword}
                <span className={`text-xs ${
                  filters.keyword === keyword
                    ? 'text-primary-200'
                    : 'text-gray-500 dark:text-gray-400'
                }`}>
                  ({count})
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Filters */}
      <FilterBar filters={filters} onFilterChange={handleFilterChange} />
      
      {/* Error state */}
      {error && (
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Failed to load listings
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {(error as Error).message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
      
      {/* Listings grid */}
      {!error && (
        <>
          <ListingGrid
            listings={data?.data || []}
            isLoading={isLoading}
          />
          
          {/* Pagination */}
          {data?.pagination && (
            <Pagination
              pagination={data.pagination}
              onPageChange={handlePageChange}
            />
          )}
        </>
      )}
    </div>
  )
}
