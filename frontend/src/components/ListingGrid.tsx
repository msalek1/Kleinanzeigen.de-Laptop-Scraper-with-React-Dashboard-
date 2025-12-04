import { Listing } from '../services/api'
import ListingCard from './ListingCard'
import { Loader2 } from 'lucide-react'

interface ListingGridProps {
  listings: Listing[]
  isLoading?: boolean
  onListingClick?: (listing: Listing) => void
}

/**
 * Grid component displaying multiple listing cards.
 * Handles loading and empty states.
 */
export default function ListingGrid({ listings, isLoading, onListingClick }: ListingGridProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading listings...</span>
      </div>
    )
  }
  
  if (listings.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">📭</div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No listings found
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Try adjusting your search filters or trigger a new scrape.
        </p>
      </div>
    )
  }
  
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {listings.map((listing) => (
        <ListingCard
          key={listing.id}
          listing={listing}
          onClick={() => onListingClick?.(listing)}
        />
      ))}
    </div>
  )
}
