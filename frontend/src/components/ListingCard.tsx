import { useCallback } from 'react'
import { ExternalLink, MapPin, Tag, Calendar, Hash, Heart, TrendingDown, TrendingUp } from 'lucide-react'
import { Listing } from '../services/api'
import { motion } from 'framer-motion'
import { useFavorites } from '../hooks/useFavorites'

interface ListingCardProps {
  listing: Listing
  onClick?: () => void
}

/**
 * Card component displaying a single notebook listing.
 * Shows image, title, price, location, and key details.
 */
export default function ListingCard({ listing, onClick }: ListingCardProps) {
  const { isFavorite, toggleFavorite } = useFavorites()
  
  const formatPrice = (price: number | null, negotiable: boolean) => {
    if (price === null) {
      return negotiable ? 'VB' : 'Price on request'
    }
    const formatted = new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(price)
    return negotiable ? `${formatted} VB` : formatted
  }
  
  const formatDate = (dateString: string | null) => {
    if (!dateString) return null
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date)
  }

  // Calculate price trend
  const getPriceTrend = () => {
    if (!listing.price_history || listing.price_history.length < 2) return null
    const latest = listing.price_history[listing.price_history.length - 1]
    const previous = listing.price_history[listing.price_history.length - 2]
    if (!latest.price || !previous.price) return null
    if (latest.price === previous.price) return null
    return latest.price < previous.price ? 'down' : 'up'
  }

  const priceTrend = getPriceTrend()

  const handleFavoriteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    toggleFavorite(listing.id)
  }, [listing.id, toggleFavorite])
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -8, scale: 1.02, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)" }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      onClick={onClick}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden cursor-pointer group relative"
    >
      {/* Favorite button */}
      <button
        onClick={handleFavoriteClick}
        className={`absolute top-2 left-2 z-10 p-2 rounded-full backdrop-blur-sm transition-all ${
          isFavorite(listing.id)
            ? 'bg-red-500 text-white shadow-lg'
            : 'bg-white/80 dark:bg-gray-800/80 text-gray-600 dark:text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500'
        }`}
      >
        <Heart className={`w-4 h-4 ${isFavorite(listing.id) ? 'fill-current' : ''}`} />
      </button>
      
      {/* Image */}
      <div className="aspect-video bg-gray-100 dark:bg-gray-700 relative overflow-hidden">
        {listing.image_url ? (
          <motion.img
            src={listing.image_url}
            alt={listing.title}
            className="w-full h-full object-cover"
            loading="lazy"
            whileHover={{ scale: 1.1 }}
            transition={{ duration: 0.4 }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <span className="text-4xl">📱</span>
          </div>
        )}
        
        {/* Price badge with trend indicator */}
        <div className="absolute top-2 right-2 flex items-center gap-1">
          {priceTrend && (
            <div className={`p-1.5 rounded-full backdrop-blur-sm ${
              priceTrend === 'down' 
                ? 'bg-green-500/90 text-white' 
                : 'bg-red-500/90 text-white'
            }`}>
              {priceTrend === 'down' ? (
                <TrendingDown className="w-3 h-3" />
              ) : (
                <TrendingUp className="w-3 h-3" />
              )}
            </div>
          )}
          <div className="bg-primary-600/90 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg border border-white/20">
            {formatPrice(listing.price_eur, listing.price_negotiable)}
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-5">
        {/* Title */}
        <h3 className="text-lg font-bold text-gray-900 dark:text-white line-clamp-2 mb-2 group-hover:text-primary-600 transition-colors">
          {listing.title}
        </h3>
        
        {/* Description */}
        {listing.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-4 leading-relaxed">
            {listing.description}
          </p>
        )}
        
        {/* Meta info */}
        <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400 mb-3">
          {listing.location.city && (
            <span className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-700/50 px-2 py-1 rounded-md">
              <MapPin className="w-3.5 h-3.5 text-primary-500" />
              {listing.location.city}
            </span>
          )}
          
          {listing.condition && (
            <span className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-700/50 px-2 py-1 rounded-md">
              <Tag className="w-3.5 h-3.5 text-primary-500" />
              {listing.condition}
            </span>
          )}
          
          {listing.posted_at && (
            <span className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-700/50 px-2 py-1 rounded-md">
              <Calendar className="w-3.5 h-3.5 text-primary-500" />
              {formatDate(listing.posted_at)}
            </span>
          )}
        </div>
        
        {/* Search keyword tags */}
        {listing.search_keywords && listing.search_keywords.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {listing.search_keywords.map((kw) => (
              <span
                key={kw}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 rounded-full text-xs font-medium border border-primary-100 dark:border-primary-800/30"
              >
                <Hash className="w-3 h-3 opacity-60" />
                {kw}
              </span>
            ))}
          </div>
        )}
        
        {/* External link */}
        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/50 flex justify-end">
            <a
            href={listing.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-semibold group/link"
            >
            View Listing
            <ExternalLink className="w-3.5 h-3.5 group-hover/link:translate-x-0.5 transition-transform" />
            </a>
        </div>
      </div>
    </motion.div>
  )
}
