import { useState, useCallback } from 'react'
import { X, ExternalLink, MapPin, Tag, Calendar, Hash, TrendingDown, TrendingUp, Minus, Heart, Share2 } from 'lucide-react'
import { Listing } from '../services/api'
import { motion, AnimatePresence } from 'framer-motion'
import { useFavorites } from '../hooks/useFavorites'

interface ListingModalProps {
  listing: Listing | null
  isOpen: boolean
  onClose: () => void
}

/**
 * Modal component for displaying full listing details.
 * Shows large image, full description, all metadata, and price history.
 */
export default function ListingModal({ listing, isOpen, onClose }: ListingModalProps) {
  const { isFavorite, toggleFavorite } = useFavorites()
  const [imageLoaded, setImageLoaded] = useState(false)
  
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
      month: 'long',
      year: 'numeric',
    }).format(date)
  }

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return null
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  // Calculate price trend from history
  const getPriceTrend = () => {
    if (!listing?.price_history || listing.price_history.length < 2) return null
    const latest = listing.price_history[listing.price_history.length - 1]
    const previous = listing.price_history[listing.price_history.length - 2]
    if (latest.price === null || previous.price === null) return null
    if (latest.price === previous.price) return { direction: 'stable', diff: 0 }
    const diff = latest.price - previous.price
    return {
      direction: diff < 0 ? 'down' : 'up',
      diff: Math.abs(diff),
    }
  }

  const priceTrend = listing ? getPriceTrend() : null

  const handleFavoriteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (listing) {
      toggleFavorite(listing.id)
    }
  }, [listing, toggleFavorite])

  const handleShareClick = useCallback(() => {
    if (!listing) return
    const text = `Check out this notebook: ${listing.title} - ${formatPrice(listing.price_eur, listing.price_negotiable)}`
    const url = `https://wa.me/?text=${encodeURIComponent(text + ' ' + listing.url)}`
    window.open(url, '_blank')
  }, [listing])

  if (!isOpen || !listing) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-4 md:inset-10 lg:inset-20 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate pr-4">
                {listing.title}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleFavoriteClick}
                  className={`p-2 rounded-full transition-colors ${
                    isFavorite(listing.id)
                      ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600 dark:bg-gray-800 dark:text-gray-400'
                  }`}
                >
                  <Heart className={`w-5 h-5 ${isFavorite(listing.id) ? 'fill-current' : ''}`} />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
                {/* Left: Image */}
                <div className="space-y-4">
                  <div className="aspect-video bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden relative">
                    {listing.image_url ? (
                      <>
                        {!imageLoaded && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                        <img
                          src={listing.image_url}
                          alt={listing.title}
                          className={`w-full h-full object-contain transition-opacity ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                          onLoad={() => setImageLoaded(true)}
                        />
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <span className="text-6xl">📱</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Price History Chart (if available) */}
                  {listing.price_history && listing.price_history.length > 0 && (
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                        <TrendingDown className="w-4 h-4" />
                        Price History
                      </h3>
                      <div className="space-y-2">
                        {listing.price_history.slice(-5).map((entry, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <span className="text-gray-500 dark:text-gray-400">
                              {formatDateTime(entry.recorded_at)}
                            </span>
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {formatPrice(entry.price, false)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Right: Details */}
                <div className="space-y-6">
                  {/* Price */}
                  <div className="flex items-center gap-4">
                    <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                      {formatPrice(listing.price_eur, listing.price_negotiable)}
                    </div>
                    {priceTrend && priceTrend.diff > 0 && (
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${
                        priceTrend.direction === 'down'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : priceTrend.direction === 'up'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                      }`}>
                        {priceTrend.direction === 'down' && <TrendingDown className="w-4 h-4" />}
                        {priceTrend.direction === 'up' && <TrendingUp className="w-4 h-4" />}
                        {priceTrend.direction === 'stable' && <Minus className="w-4 h-4" />}
                        {priceTrend.direction === 'down' ? '-' : '+'}{formatPrice(priceTrend.diff, false)}
                      </div>
                    )}
                  </div>
                  
                  {/* Meta info */}
                  <div className="grid grid-cols-2 gap-4">
                    {listing.location.city && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <MapPin className="w-4 h-4 text-primary-500" />
                        <span>{listing.location.city}</span>
                        {listing.location.state && <span className="text-gray-400">({listing.location.state})</span>}
                      </div>
                    )}
                    
                    {listing.condition && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <Tag className="w-4 h-4 text-primary-500" />
                        <span>{listing.condition}</span>
                      </div>
                    )}
                    
                    {listing.posted_at && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <Calendar className="w-4 h-4 text-primary-500" />
                        <span>{formatDate(listing.posted_at)}</span>
                      </div>
                    )}
                    
                    {listing.seller_type && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs font-medium">
                          {listing.seller_type}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Keywords */}
                  {listing.search_keywords && listing.search_keywords.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Matched Keywords
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {listing.search_keywords.map((kw) => (
                          <span
                            key={kw}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 rounded-full text-sm font-medium"
                          >
                            <Hash className="w-3 h-3" />
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Description */}
                  {listing.description && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Description
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap leading-relaxed">
                        {listing.description}
                      </p>
                    </div>
                  )}
                  
                  {/* Timestamps */}
                  <div className="text-xs text-gray-400 dark:text-gray-500 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <p>Scraped: {formatDateTime(listing.scraped_at)}</p>
                    <p>External ID: {listing.external_id}</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex gap-3">
              <button
                onClick={handleShareClick}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold transition-colors"
              >
                <Share2 className="w-4 h-4" />
                Share via WhatsApp
              </button>
              <a
                href={listing.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold transition-colors"
              >
                View on Kleinanzeigen
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
