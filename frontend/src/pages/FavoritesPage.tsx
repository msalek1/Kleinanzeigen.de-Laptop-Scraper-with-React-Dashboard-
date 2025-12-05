import { useState, useCallback, useMemo } from 'react'
import { Heart, Trash2, ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useListings } from '../hooks/useApi'
import { useFavorites } from '../hooks/useFavorites'
import ListingCard from '../components/ListingCard'
import ListingModal from '../components/ListingModal'
import { Listing } from '../services/api'

/**
 * Favorites page displaying all saved listings.
 * Uses localStorage for persistence.
 */
export default function FavoritesPage() {
  const { favorites, clearFavorites, favoritesCount } = useFavorites()
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null)
  
  // Fetch all listings and filter to favorites
  // In a real app, you'd have an API endpoint to fetch by IDs
  const { data, isLoading } = useListings({ per_page: 100 })
  
  const favoriteListings = useMemo(() => {
    if (!data?.data) return []
    return data.data.filter(listing => favorites.includes(listing.id))
  }, [data, favorites])

  const handleCardClick = useCallback((listing: Listing) => {
    setSelectedListing(listing)
  }, [])

  return (
    <div className="max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link 
          to="/"
          className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to listings
        </Link>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <Heart className="w-6 h-6 text-red-600 dark:text-red-400 fill-current" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Favorites
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                {favoritesCount} saved {favoritesCount === 1 ? 'listing' : 'listings'}
              </p>
            </div>
          </div>
          
          {favoritesCount > 0 && (
            <button
              onClick={clearFavorites}
              className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-100 dark:bg-gray-800 rounded-xl h-80 animate-pulse" />
          ))}
        </div>
      ) : favoriteListings.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-20"
        >
          <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <Heart className="w-10 h-10 text-gray-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            No favorites yet
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
            Start browsing listings and click the heart icon to save your favorites here.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-full font-medium hover:bg-primary-700 transition-colors"
          >
            Browse Listings
          </Link>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {favoriteListings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              onClick={() => handleCardClick(listing)}
            />
          ))}
        </div>
      )}

      {/* Listing Modal */}
      <ListingModal
        listing={selectedListing}
        isOpen={!!selectedListing}
        onClose={() => setSelectedListing(null)}
      />
    </div>
  )
}
