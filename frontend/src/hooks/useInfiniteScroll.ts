import { useRef, useCallback, useEffect } from 'react'

interface UseInfiniteScrollOptions {
  /** Callback when intersection is triggered */
  onLoadMore: () => void
  /** Whether there are more items to load */
  hasNextPage: boolean
  /** Whether currently loading */
  isLoading: boolean
  /** Root margin for intersection observer */
  rootMargin?: string
  /** Threshold for intersection */
  threshold?: number
}

/**
 * Hook for implementing infinite scroll using Intersection Observer.
 * Returns a ref to attach to a sentinel element at the bottom of the list.
 * 
 * @example
 * const { sentinelRef } = useInfiniteScroll({
 *   onLoadMore: () => fetchNextPage(),
 *   hasNextPage: data.pagination.has_next,
 *   isLoading: isFetchingNextPage,
 * })
 * 
 * return (
 *   <>
 *     {items.map(item => <Item key={item.id} {...item} />)}
 *     <div ref={sentinelRef} />
 *   </>
 * )
 */
export function useInfiniteScroll({
  onLoadMore,
  hasNextPage,
  isLoading,
  rootMargin = '200px',
  threshold = 0,
}: UseInfiniteScrollOptions) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries
      if (entry.isIntersecting && hasNextPage && !isLoading) {
        onLoadMore()
      }
    },
    [onLoadMore, hasNextPage, isLoading]
  )

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    // Disconnect previous observer
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    // Create new observer
    observerRef.current = new IntersectionObserver(handleIntersection, {
      rootMargin,
      threshold,
    })

    observerRef.current.observe(sentinel)

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [handleIntersection, rootMargin, threshold])

  return { sentinelRef }
}

export default useInfiniteScroll
