import { useState, useCallback, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'

interface OptimizedImageProps {
  src: string | null
  alt: string
  className?: string
  placeholderClassName?: string
  /** Fallback content when no image URL */
  fallback?: React.ReactNode
  /** Enable lazy loading with intersection observer */
  lazy?: boolean
  /** Root margin for lazy loading */
  rootMargin?: string
}

/**
 * Optimized image component with lazy loading and blur placeholder.
 * Features:
 * - Blur-up effect on load
 * - Intersection observer for lazy loading
 * - Graceful fallback for missing images
 * - Smooth fade-in animation
 * 
 * @example
 * <OptimizedImage
 *   src={listing.image_url}
 *   alt={listing.title}
 *   className="w-full h-48 object-cover"
 *   fallback={<span className="text-4xl">📱</span>}
 *   lazy
 * />
 */
export default function OptimizedImage({
  src,
  alt,
  className = '',
  placeholderClassName = '',
  fallback,
  lazy = true,
  rootMargin = '200px',
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(!lazy)
  const [hasError, setHasError] = useState(false)
  const imgRef = useRef<HTMLDivElement>(null)

  // Intersection observer for lazy loading
  useEffect(() => {
    if (!lazy || !imgRef.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      { rootMargin }
    )

    observer.observe(imgRef.current)

    return () => observer.disconnect()
  }, [lazy, rootMargin])

  const handleLoad = useCallback(() => {
    setIsLoaded(true)
  }, [])

  const handleError = useCallback(() => {
    setHasError(true)
    setIsLoaded(true)
  }, [])

  // No image URL or error loading
  if (!src || hasError) {
    return (
      <div
        ref={imgRef}
        className={`flex items-center justify-center bg-gray-100 dark:bg-gray-700 ${className}`}
      >
        {fallback || (
          <span className="text-gray-400 text-4xl">📷</span>
        )}
      </div>
    )
  }

  return (
    <div ref={imgRef} className={`relative overflow-hidden ${className}`}>
      {/* Blur placeholder */}
      <div
        className={`absolute inset-0 bg-gray-200 dark:bg-gray-700 ${placeholderClassName} ${
          isLoaded ? 'opacity-0' : 'opacity-100'
        } transition-opacity duration-300`}
      >
        {/* Shimmer effect */}
        <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </div>

      {/* Actual image */}
      {isInView && (
        <motion.img
          src={src}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{
            opacity: isLoaded ? 1 : 0,
            scale: isLoaded ? 1 : 1.1,
          }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className={`w-full h-full object-cover ${className}`}
          loading="lazy"
          decoding="async"
        />
      )}
    </div>
  )
}

// Add shimmer animation to tailwind (via CSS)
// This should be added to your CSS file or tailwind config:
// @keyframes shimmer {
//   100% { transform: translateX(100%); }
// }
// .animate-shimmer { animation: shimmer 1.5s infinite; }
