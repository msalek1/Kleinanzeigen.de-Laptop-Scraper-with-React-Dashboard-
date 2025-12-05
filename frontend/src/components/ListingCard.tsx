import { ExternalLink, MapPin, Tag, Calendar, Hash } from 'lucide-react'
import { Listing } from '../services/api'

interface ListingCardProps {
  listing: Listing
  onClick?: () => void
}

/**
 * Card component displaying a single notebook listing.
 * Shows image, title, price, location, and key details.
 */
export default function ListingCard({ listing, onClick }: ListingCardProps) {
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
  
  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
    >
      {/* Image */}
      <div className="aspect-video bg-gray-100 dark:bg-gray-700 relative overflow-hidden">
        {listing.image_url ? (
          <img
            src={listing.image_url}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <span className="text-4xl">📱</span>
          </div>
        )}
        
        {/* Price badge */}
        <div className="absolute top-2 right-2 bg-primary-600 text-white px-3 py-1 rounded-full text-sm font-semibold shadow-lg">
          {formatPrice(listing.price_eur, listing.price_negotiable)}
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4">
        {/* Title */}
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-2 mb-2 group-hover:text-primary-600 transition-colors">
          {listing.title}
        </h3>
        
        {/* Description */}
        {listing.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
            {listing.description}
          </p>
        )}
        
        {/* Meta info */}
        <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
          {listing.location.city && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {listing.location.city}
            </span>
          )}
          
          {listing.condition && (
            <span className="flex items-center gap-1">
              <Tag className="w-3 h-3" />
              {listing.condition}
            </span>
          )}
          
          {listing.posted_at && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(listing.posted_at)}
            </span>
          )}
        </div>
        
        {/* Search keyword tags */}
        {listing.search_keywords && listing.search_keywords.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {listing.search_keywords.map((kw) => (
              <span
                key={kw}
                className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded text-xs font-medium"
              >
                <Hash className="w-2.5 h-2.5" />
                {kw}
              </span>
            ))}
          </div>
        )}
        
        {/* External link */}
        <a
          href={listing.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-3 inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          View on Kleinanzeigen
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  )
}
