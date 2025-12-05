import { useState, useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { RefreshCw, Loader2, AlertCircle, X, Sparkles } from 'lucide-react'
import { useListings, useTriggerScraper, useKeywords } from '../hooks/useApi'
import { ListingsParams, Listing } from '../services/api'
import FilterBar from '../components/FilterBar'
import ListingGrid from '../components/ListingGrid'
import Pagination from '../components/Pagination'
import StatsPanel from '../components/StatsPanel'
import ListingModal from '../components/ListingModal'
import ScraperProgressPanel from '../components/ScraperProgressPanel'
import { useScraperSSE } from '../hooks/useScraperSSE'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * Home page displaying the main listings view with filters.
 * Supports URL query params for shareable filter states.
 */
export default function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null)
  const [currentJobId, setCurrentJobId] = useState<number | null>(null)
  
  // SSE for real-time scraper progress
  const { progress, isConnected } = useScraperSSE(currentJobId, {
    onComplete: () => {
      // Refetch listings after scrape completes
      refetch()
      setCurrentJobId(null)
    },
  })
  
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
      const result = await triggerScraper.mutateAsync({ page_limit: 3 })
      // Set job ID to start SSE connection
      if (result.data?.id) {
        setCurrentJobId(result.data.id)
      }
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
  
  const showStats = searchParams.get('view') === 'stats'
  
  return (
    <div className="max-w-[1600px] mx-auto">
      {/* Hero Section */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative py-12 mb-12 text-center"
      >
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary-100/50 via-transparent to-transparent dark:from-primary-900/20 dark:via-transparent dark:to-transparent opacity-70 blur-3xl pointer-events-none" />
        
        <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 text-primary-700 dark:text-primary-300 text-xs font-semibold tracking-wide uppercase mb-4"
        >
            <Sparkles className="w-3 h-3" />
            Discover Great Deals
        </motion.div>

        <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-4">
          Find Your Perfect <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-emerald-500 dark:from-primary-400 dark:to-emerald-400">
            Notebook Today
          </span>
        </h1>
        
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-8 leading-relaxed">
          Browse thousands of curated notebook listings from Kleinanzeigen. 
          Analyze prices, compare specs, and find the best value for your money.
        </p>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleTriggerScrape}
          disabled={triggerScraper.isPending}
          className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold text-sm"
        >
          {triggerScraper.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Scraping New Listings...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Refresh Listings
            </>
          )}
        </motion.button>
      </motion.div>
      
      {/* Success/error messages */}
      {triggerScraper.isSuccess && (
        <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-8 max-w-2xl mx-auto p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-green-700 dark:text-green-400 flex items-center justify-center gap-2 font-medium"
        >
          <Sparkles className="w-5 h-5" />
          {triggerScraper.data.message || 'Scraping completed successfully!'}
        </motion.div>
      )}
      
      {triggerScraper.isError && (
        <div className="mb-8 max-w-2xl mx-auto p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 flex items-center justify-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Failed to trigger scraper. Please try again later.
        </div>
      )}
      
      {/* Real-time scraper progress */}
      <AnimatePresence>
        {(isConnected || triggerScraper.isPending) && (
          <ScraperProgressPanel 
            progress={progress} 
            isRunning={isConnected && progress?.status === 'running'}
            isStarting={triggerScraper.isPending && !isConnected}
          />
        )}
      </AnimatePresence>
      
      {/* Stats panel (conditional) */}
      {showStats && <StatsPanel />}
      
      {/* Main Content Area */}
      <div className="space-y-8">
        
        {/* Filter Bar */}
        <FilterBar filters={filters} onFilterChange={handleFilterChange} />

        {/* Keyword Tags */}
        {keywordsData?.data && keywordsData.data.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center mb-8">
                {keywordsData.data.slice(0, 10).map(({ keyword, count }) => (
                <motion.button
                    key={keyword}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    whileHover={{ scale: 1.05 }}
                    onClick={() => handleKeywordClick(keyword)}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all shadow-sm border ${
                    filters.keyword === keyword
                        ? 'bg-primary-600 border-primary-600 text-white shadow-primary-500/30'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-primary-300 dark:hover:border-primary-700'
                    }`}
                >
                    {filters.keyword === keyword && <X className="w-3 h-3" />}
                    {keyword}
                    <span className={`text-xs ml-0.5 ${
                    filters.keyword === keyword
                        ? 'text-primary-100'
                        : 'text-gray-400'
                    }`}>
                    {count}
                    </span>
                </motion.button>
                ))}
            </div>
        )}

        {/* Error state */}
        {error && (
            <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-red-100 dark:border-red-900/30 shadow-sm">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Failed to load listings
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
                {(error as Error).message || 'An unexpected error occurred while fetching data.'}
            </p>
            <button
                onClick={() => refetch()}
                className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium shadow-lg shadow-primary-600/20"
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
                onListingClick={setSelectedListing}
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
      
      {/* Listing detail modal */}
      <ListingModal
        listing={selectedListing}
        isOpen={!!selectedListing}
        onClose={() => setSelectedListing(null)}
      />
    </div>
  )
}
