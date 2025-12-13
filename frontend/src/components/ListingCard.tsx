import { useCallback } from 'react'
import { ExternalLink, MapPin, Tag, Calendar, Hash, Heart, TrendingDown, TrendingUp, Archive, ArchiveX, Gamepad2, Briefcase, Laptop, Wrench, RefreshCw, Cpu, HardDrive, Palette } from 'lucide-react'
import { Listing } from '../services/api'
import { motion } from 'framer-motion'
import { useFavorites } from '../hooks/useFavorites'
import OptimizedImage from './OptimizedImage'

interface ListingCardProps {
  listing: Listing
  onClick?: () => void
  /** Whether this listing is archived */
  isArchived?: boolean
  /** Callback when archive status is toggled */
  onArchiveToggle?: (listingId: number) => void
}

// Category badge config
const CATEGORY_BADGES: Record<string, { icon: React.ReactNode; bg: string; text: string }> = {
  gaming: { icon: <Gamepad2 className="w-3 h-3" />, bg: 'bg-red-500', text: 'text-white' },
  business: { icon: <Briefcase className="w-3 h-3" />, bg: 'bg-blue-500', text: 'text-white' },
  ultrabook: { icon: <Laptop className="w-3 h-3" />, bg: 'bg-purple-500', text: 'text-white' },
  workstation: { icon: <Wrench className="w-3 h-3" />, bg: 'bg-orange-500', text: 'text-white' },
  '2in1': { icon: <RefreshCw className="w-3 h-3" />, bg: 'bg-teal-500', text: 'text-white' },
}

// Tag category icons
const TAG_ICONS: Record<string, React.ReactNode> = {
  cpu_model: <Cpu className="w-2.5 h-2.5" />,
  ram: <HardDrive className="w-2.5 h-2.5" />,
  gpu: <Palette className="w-2.5 h-2.5" />,
  brand: <Tag className="w-2.5 h-2.5" />,
}

/**
 * Card component displaying a single notebook listing.
 * Shows image, title, price, location, and key details.
 */
export default function ListingCard({ listing, onClick, isArchived = false, onArchiveToggle }: ListingCardProps) {
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
  const categoryBadge = listing.laptop_category ? CATEGORY_BADGES[listing.laptop_category] : null

  // Get top 3 most relevant hardware tags
  const displayTags = (listing.tags || [])
    .filter(tag => ['cpu_model', 'ram', 'gpu', 'brand'].includes(tag.category))
    .slice(0, 3)

  const handleFavoriteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    toggleFavorite(listing.id)
  }, [listing.id, toggleFavorite])

  const handleArchiveClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onArchiveToggle?.(listing.id)
  }, [listing.id, onArchiveToggle])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: isArchived ? 0.6 : 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -8, scale: 1.02, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)" }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      onClick={onClick}
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden cursor-pointer group relative ${isArchived ? 'grayscale-[30%]' : ''}`}
    >
      {/* Archive badge overlay */}
      {isArchived && (
        <div className="absolute inset-0 z-20 bg-gray-900/10 pointer-events-none flex items-center justify-center">
          <div className="bg-gray-800/80 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
            <Archive className="w-3 h-3" />
            Archived
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="absolute top-2 left-2 z-10 flex gap-1">
        {/* Favorite button */}
        <button
          onClick={handleFavoriteClick}
          className={`p-2 rounded-full backdrop-blur-sm transition-all ${isFavorite(listing.id)
            ? 'bg-red-500 text-white shadow-lg'
            : 'bg-white/80 dark:bg-gray-800/80 text-gray-600 dark:text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500'
            }`}
        >
          <Heart className={`w-4 h-4 ${isFavorite(listing.id) ? 'fill-current' : ''}`} />
        </button>

        {/* Archive button */}
        {onArchiveToggle && (
          <button
            onClick={handleArchiveClick}
            className={`p-2 rounded-full backdrop-blur-sm transition-all ${isArchived
              ? 'bg-amber-500 text-white shadow-lg'
              : 'bg-white/80 dark:bg-gray-800/80 text-gray-600 dark:text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-amber-50 hover:text-amber-500'
              }`}
            title={isArchived ? 'Unarchive' : 'Archive'}
          >
            {isArchived ? (
              <ArchiveX className="w-4 h-4" />
            ) : (
              <Archive className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Image */}
      <div className="aspect-video bg-gray-100 dark:bg-gray-700 relative overflow-hidden">
        <OptimizedImage
          src={listing.image_url}
          alt={listing.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-400"
          fallback={<span className="text-4xl">📱</span>}
          lazy
        />

        {/* Category badge */}
        {categoryBadge && (
          <div className={`absolute top-2 left-12 ${categoryBadge.bg} ${categoryBadge.text} px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg`}>
            {categoryBadge.icon}
            <span className="capitalize">{listing.laptop_category}</span>
          </div>
        )}

        {/* Price badge with trend indicator */}
        <div className="absolute top-2 right-2 flex items-center gap-1">
          {priceTrend && (
            <div className={`p-1.5 rounded-full backdrop-blur-sm ${priceTrend === 'down'
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

        {/* Hardware tags */}
        {displayTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {displayTags.map((tag) => (
              <span
                key={`${tag.category}-${tag.value}`}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs font-medium"
              >
                {TAG_ICONS[tag.category]}
                {tag.value}
              </span>
            ))}
          </div>
        )}

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

