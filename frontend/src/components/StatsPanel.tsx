import { TrendingUp, TrendingDown, MapPin, DollarSign } from 'lucide-react'
import { useStats } from '../hooks/useApi'

/**
 * Statistics panel showing aggregate listing data.
 * Displays total count, price statistics, and top cities.
 */
export default function StatsPanel() {
  const { data, isLoading, error } = useStats()
  
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }
  
  if (error || !data) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 text-center text-gray-500">
        Failed to load statistics
      </div>
    )
  }
  
  const stats = data.data
  
  const formatPrice = (price: number | null) => {
    if (price === null) return 'N/A'
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(price)
  }
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Market Statistics
      </h2>
      
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Listings</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {stats.total_listings.toLocaleString()}
          </div>
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
            <DollarSign className="w-4 h-4" />
            Average Price
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatPrice(stats.average_price)}
          </div>
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
            <TrendingDown className="w-4 h-4 text-green-500" />
            Min Price
          </div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatPrice(stats.min_price)}
          </div>
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
            <TrendingUp className="w-4 h-4 text-red-500" />
            Max Price
          </div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {formatPrice(stats.max_price)}
          </div>
        </div>
      </div>
      
      {/* Top cities */}
      {stats.listings_by_city.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            Top Cities
          </h3>
          <div className="flex flex-wrap gap-2">
            {stats.listings_by_city.map(({ city, count }) => (
              <span
                key={city}
                className="inline-flex items-center gap-1 px-3 py-1 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 rounded-full text-sm"
              >
                {city}
                <span className="text-primary-500 dark:text-primary-400 font-medium">
                  ({count})
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
