import { Listing } from '../services/api'
import ListingCard from './ListingCard'
import { Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

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
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Loader2 className="w-10 h-10 text-primary-600" />
        </motion.div>
        <motion.span 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 text-gray-500 dark:text-gray-400 font-medium"
        >
          Finding the best deals...
        </motion.span>
      </div>
    )
  }
  
  if (listings.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-16"
      >
        <div className="text-6xl mb-6">📭</div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          No listings found
        </h3>
        <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          We couldn't find any notebooks matching your criteria. Try adjusting your filters or check back later.
        </p>
      </motion.div>
    )
  }
  
  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
    >
      <AnimatePresence mode='popLayout'>
        {listings.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            onClick={() => onListingClick?.(listing)}
          />
        ))}
      </AnimatePresence>
    </motion.div>
  )
}
