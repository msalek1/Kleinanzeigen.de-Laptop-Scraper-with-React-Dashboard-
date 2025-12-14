import { useState, useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { RefreshCw, Loader2, AlertCircle, X, Sparkles, Archive, Eye, EyeOff, Copy, Check, Settings } from 'lucide-react'
import { useListings, useKeywords } from '../hooks/useApi'
import { ListingsParams, Listing, recommendationApi, ListingWithScore } from '../services/api'
import FilterBar from '../components/FilterBar'
import ListingGrid from '../components/ListingGrid'
import Pagination from '../components/Pagination'
import StatsPanel from '../components/StatsPanel'
import ListingModal from '../components/ListingModal'
import ScraperProgressPanel from '../components/ScraperProgressPanel'
import CategoryTabs from '../components/CategoryTabs'
import QuickFilterChips from '../components/QuickFilterChips'
import DatePeriodFilter from '../components/DatePeriodFilter'
import RecommendationTabs, { RecommendationView } from '../components/RecommendationTabs'
import PreferencesPanel from '../components/PreferencesPanel'
import { useScraperWithProgress } from '../hooks/useScraperSSE'
import { useArchive } from '../hooks/useArchive'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * Home page displaying the main listings view with filters.
 * Supports URL query params for shareable filter states.
 */
export default function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null)
  const [hideArchived, setHideArchived] = useState(false)
  const [showSyncCode, setShowSyncCode] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)

  // Recommendation engine state
  const [recommendationView, setRecommendationView] = useState<RecommendationView>('all')
  const [showPreferences, setShowPreferences] = useState(false)
  const [hasPreferences, setHasPreferences] = useState(false)
  const [mustSeeItems, setMustSeeItems] = useState<ListingWithScore[]>([])
  const [recommendedItems, setRecommendedItems] = useState<ListingWithScore[]>([])
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false)

  const {
    startScraper,
    progress: scraperProgress,
    result: scraperResult,
    isStarting,
    isRunning,
    error: scraperError,
  } = useScraperWithProgress()

  const {
    archivedIds,
    toggleArchive,
    syncCode,
  } = useArchive()

  const progressForPanel = scraperProgress || scraperResult

  // Parse filters from URL
  const getFiltersFromUrl = useCallback((): ListingsParams => {
    const params: ListingsParams = {
      page: parseInt(searchParams.get('page') || '1'),
      per_page: parseInt(searchParams.get('per_page') || '20'),
      item_type: 'laptop',
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

    const itemType = searchParams.get('item_type') as ListingsParams['item_type']
    if (itemType) params.item_type = itemType

    const laptopCategory = searchParams.get('laptop_category') as ListingsParams['laptop_category']
    if (laptopCategory) params.laptop_category = laptopCategory

    const tags = searchParams.get('tags')
    if (tags) params.tags = tags

    const sort = searchParams.get('sort') as ListingsParams['sort']
    if (sort) params.sort = sort

    const order = searchParams.get('order') as 'asc' | 'desc'
    if (order) params.order = order

    const datePeriod = searchParams.get('date_period') as ListingsParams['date_period']
    if (datePeriod) params.date_period = datePeriod

    const dateFrom = searchParams.get('date_from')
    if (dateFrom) params.date_from = dateFrom

    const dateTo = searchParams.get('date_to')
    if (dateTo) params.date_to = dateTo

    return params
  }, [searchParams])

  const [filters, setFilters] = useState<ListingsParams>(getFiltersFromUrl)

  // Selected tags as array
  const selectedTags = useMemo(() => {
    return filters.tags ? filters.tags.split(',').filter(t => t.trim()) : []
  }, [filters.tags])

  // Update URL when filters change
  const handleFilterChange = useCallback((newFilters: ListingsParams) => {
    console.log('[HomePage] handleFilterChange called with:', newFilters)
    setFilters(newFilters)

    const params = new URLSearchParams()
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        if (key === 'item_type' && value === 'laptop') return
        console.log('[HomePage] Adding to URL params:', key, '=', value)
        params.set(key, String(value))
      }
    })
    console.log('[HomePage] Final URL params:', params.toString())
    setSearchParams(params)
  }, [setSearchParams])

  // Handle laptop category change
  const handleCategoryChange = useCallback((category: string | undefined) => {
    handleFilterChange({
      ...filters,
      laptop_category: category as ListingsParams['laptop_category'],
      page: 1
    })
  }, [filters, handleFilterChange])

  // Handle tags change
  const handleTagsChange = useCallback((tags: string[]) => {
    handleFilterChange({
      ...filters,
      tags: tags.length > 0 ? tags.join(',') : undefined,
      page: 1
    })
  }, [filters, handleFilterChange])

  // Handle date period change
  const handleDatePeriodChange = useCallback((period: ListingsParams['date_period']) => {
    console.log('[HomePage] handleDatePeriodChange called with:', period)
    console.log('[HomePage] current filters:', filters)
    const newFilters = {
      ...filters,
      date_period: period,
      date_from: undefined,
      date_to: undefined,
      page: 1
    }
    console.log('[HomePage] new filters will be:', newFilters)
    handleFilterChange(newFilters)
  }, [filters, handleFilterChange])

  // Handle custom date range change
  const handleDateRangeChange = useCallback((from: string | undefined, to: string | undefined) => {
    handleFilterChange({
      ...filters,
      date_period: undefined,
      date_from: from,
      date_to: to,
      page: 1
    })
  }, [filters, handleFilterChange])

  // Copy sync code to clipboard
  const handleCopySyncCode = useCallback(async () => {
    if (syncCode) {
      await navigator.clipboard.writeText(syncCode)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    }
  }, [syncCode])

  // Sync from URL on navigation
  useEffect(() => {
    setFilters(getFiltersFromUrl())
  }, [searchParams, getFiltersFromUrl])

  // Fetch listings with exclude_archived if enabled
  const listingFilters = useMemo(() => {
    if (hideArchived) {
      return { ...filters, exclude_archived: true }
    }
    return filters
  }, [filters, hideArchived])

  const { data, isLoading, error, refetch } = useListings(listingFilters)

  // Refetch listings once scraping completes
  useEffect(() => {
    if (scraperResult?.status === 'completed') {
      refetch()
    }
  }, [scraperResult?.status, refetch])

  // Fetch keywords for filter tags
  const { data: keywordsData } = useKeywords()

  const handleTriggerScrape = useCallback(() => {
    startScraper(3)
  }, [startScraper])

  const handlePageChange = useCallback((page: number) => {
    handleFilterChange({ ...filters, page })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [filters, handleFilterChange])

  const handleKeywordClick = useCallback((keyword: string) => {
    // If clicking the already-selected keyword, clear it
    if (filters.keyword === keyword) {
      handleFilterChange({ ...filters, keyword: undefined, page: 1 })
    } else {
      handleFilterChange({ ...filters, keyword, page: 1 })
    }
  }, [filters, handleFilterChange])

  const showStats = searchParams.get('view') === 'stats'

  // Fetch recommendations when view changes
  useEffect(() => {
    const fetchRecommendations = async () => {
      if (recommendationView === 'all') return

      setIsLoadingRecommendations(true)
      try {
        if (recommendationView === 'must_see') {
          const { data } = await recommendationApi.getMustSee(20)
          setMustSeeItems(data)
        } else if (recommendationView === 'recommended') {
          const { data } = await recommendationApi.getRecommended(20)
          setRecommendedItems(data)
        }
      } catch (err) {
        console.error('Failed to fetch recommendations:', err)
      } finally {
        setIsLoadingRecommendations(false)
      }
    }

    fetchRecommendations()
  }, [recommendationView])

  // Check if user has preferences set
  useEffect(() => {
    const checkPreferences = async () => {
      try {
        const { data } = await recommendationApi.getPreferences()
        const hasAnyPreference =
          (data.keywords && data.keywords.length > 0) ||
          (data.brands && data.brands.length > 0) ||
          data.min_price !== null ||
          data.max_price !== null
        setHasPreferences(hasAnyPreference)
      } catch (err) {
        console.error('Failed to check preferences:', err)
      }
    }
    checkPreferences()
  }, [])

  // Handle view change
  const handleViewChange = useCallback((view: RecommendationView) => {
    setRecommendationView(view)
  }, [])

  // Get display listings based on view
  const displayListings = useMemo(() => {
    if (recommendationView === 'must_see') {
      return mustSeeItems
    } else if (recommendationView === 'recommended') {
      return recommendedItems
    }
    return data?.data || []
  }, [recommendationView, mustSeeItems, recommendedItems, data?.data])

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
            Laptop Today
          </span>
        </h1>

        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-8 leading-relaxed">
          Browse thousands of curated laptop listings from Kleinanzeigen.
          Analyze prices, compare specs, and find the best value for your money.
        </p>

        <div className="flex items-center justify-center gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleTriggerScrape}
            disabled={isStarting || isRunning}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold text-sm"
          >
            {isStarting || isRunning ? (
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

          {/* Archive toggle */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setHideArchived(!hideArchived)}
            className={`inline-flex items-center gap-2 px-4 py-3 rounded-full shadow-md transition-all font-medium text-sm ${hideArchived
              ? 'bg-amber-500 text-white'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
              }`}
            title={hideArchived ? 'Show archived listings' : 'Hide archived listings'}
          >
            {hideArchived ? (
              <>
                <EyeOff className="w-4 h-4" />
                Hiding Archived
              </>
            ) : (
              <>
                <Eye className="w-4 h-4" />
                Show All
              </>
            )}
          </motion.button>
        </div>

        {/* Sync code display */}
        {syncCode && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              onClick={() => setShowSyncCode(!showSyncCode)}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-1"
            >
              <Archive className="w-3 h-3" />
              {showSyncCode ? 'Hide' : 'Show'} Sync Code
            </button>
            {showSyncCode && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2"
              >
                <code className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono">
                  {syncCode}
                </code>
                <button
                  onClick={handleCopySyncCode}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  title="Copy sync code"
                >
                  {copiedCode ? (
                    <Check className="w-3 h-3 text-green-500" />
                  ) : (
                    <Copy className="w-3 h-3 text-gray-400" />
                  )}
                </button>
              </motion.div>
            )}
          </div>
        )}
      </motion.div>

      {/* Success/error messages */}
      {scraperResult?.status === 'completed' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mb-8 max-w-2xl mx-auto p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-green-700 dark:text-green-400 flex items-center justify-center gap-2 font-medium"
        >
          <Sparkles className="w-5 h-5" />
          {scraperResult.message || 'Scraping completed successfully!'}
        </motion.div>
      )}

      {scraperResult?.status === 'failed' && (
        <div className="mb-8 max-w-2xl mx-auto p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 flex items-center justify-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {scraperResult.error || 'Scraper failed. Please check logs and try again.'}
        </div>
      )}

      {scraperError && scraperResult?.status !== 'failed' && (
        <div className="mb-8 max-w-2xl mx-auto p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl text-yellow-800 dark:text-yellow-300 flex items-center justify-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Live progress connection lost. The job may still be running.
        </div>
      )}

      {/* Real-time scraper progress */}
      <AnimatePresence>
        <ScraperProgressPanel
          progress={progressForPanel}
          isRunning={isRunning && progressForPanel?.status === 'running'}
          isStarting={isStarting}
        />
      </AnimatePresence>

      {/* Stats panel (conditional) */}
      {showStats && <StatsPanel />}

      {/* Main Content Area */}
      <div className="space-y-6">

        {/* AI Recommendations Section */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <RecommendationTabs
            selectedView={recommendationView}
            onViewChange={handleViewChange}
            hasPreferences={hasPreferences}
            mustSeeCount={mustSeeItems.length}
            recommendedCount={recommendedItems.length}
          />
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowPreferences(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg shadow-md hover:shadow-lg transition-all text-sm font-medium"
          >
            <Settings className="w-4 h-4" />
            Preferences
          </motion.button>
        </div>

        {/* Loading indicator for recommendations */}
        {isLoadingRecommendations && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            <span className="ml-2 text-gray-600 dark:text-gray-400">Loading recommendations...</span>
          </div>
        )}

        {/* Category Tabs (only show in "All" view) */}
        {recommendationView === 'all' && (
          <CategoryTabs
            selectedCategory={filters.laptop_category}
            onCategoryChange={handleCategoryChange}
          />
        )}

        {/* Filter Bar */}
        <FilterBar filters={filters} onFilterChange={handleFilterChange} />

        {/* Quick Filter Chips */}
        <QuickFilterChips
          selectedTags={selectedTags}
          onTagsChange={handleTagsChange}
          maxChips={12}
        />

        {/* Date Period Filter */}
        <div className="flex justify-center">
          <DatePeriodFilter
            selectedPeriod={filters.date_period}
            dateFrom={filters.date_from}
            dateTo={filters.date_to}
            onPeriodChange={handleDatePeriodChange}
            onDateRangeChange={handleDateRangeChange}
            compact
          />
        </div>

        {/* Keyword Tags */}
        {keywordsData?.data && keywordsData.data.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-center mb-4">
            {keywordsData.data.slice(0, 10).map(({ keyword, count }) => (
              <motion.button
                key={keyword}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.05 }}
                onClick={() => handleKeywordClick(keyword)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all shadow-sm border ${filters.keyword === keyword
                  ? 'bg-primary-600 border-primary-600 text-white shadow-primary-500/30'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-primary-300 dark:hover:border-primary-700'
                  }`}
              >
                {filters.keyword === keyword && <X className="w-3 h-3" />}
                {keyword}
                <span className={`text-xs ml-0.5 ${filters.keyword === keyword
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
              listings={displayListings}
              isLoading={isLoading || isLoadingRecommendations}
              onListingClick={setSelectedListing}
              archivedIds={archivedIds}
              onArchiveToggle={toggleArchive}
            />

            {/* Pagination (only in All view) */}
            {recommendationView === 'all' && data?.pagination && (
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

      {/* Preferences panel modal */}
      <PreferencesPanel
        isOpen={showPreferences}
        onClose={() => setShowPreferences(false)}
        onSave={(prefs) => {
          setHasPreferences(
            (prefs.keywords?.length > 0) ||
            (prefs.brands?.length > 0) ||
            prefs.min_price !== null ||
            prefs.max_price !== null
          )
          // Refresh recommendations with new preferences
          if (recommendationView !== 'all') {
            setRecommendationView('all')
            setTimeout(() => setRecommendationView(recommendationView), 100)
          }
        }}
      />
    </div>
  )
}

