/**
 * React Query hooks for data fetching and state management.
 * 
 * These hooks wrap the API client and provide caching, loading states,
 * and error handling for listings, stats, and scraper operations.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listingsApi, statsApi, scraperApi, keywordsApi, ListingsParams } from '../services/api'

// Query keys for cache management
export const queryKeys = {
  listings: (params: ListingsParams) => ['listings', params] as const,
  listing: (id: number) => ['listing', id] as const,
  stats: ['stats'] as const,
  keywords: ['keywords'] as const,
  scraperJobs: (params?: { page?: number; status?: string }) => ['scraperJobs', params] as const,
  scraperJob: (id: number) => ['scraperJob', id] as const,
}

/**
 * Hook to fetch paginated listings with filters.
 */
export function useListings(params: ListingsParams = {}) {
  return useQuery({
    queryKey: queryKeys.listings(params),
    queryFn: () => listingsApi.getListings(params),
  })
}

/**
 * Hook to fetch a single listing by ID.
 */
export function useListing(id: number) {
  return useQuery({
    queryKey: queryKeys.listing(id),
    queryFn: () => listingsApi.getListing(id),
    enabled: !!id,
  })
}

/**
 * Hook to fetch aggregate statistics.
 */
export function useStats() {
  return useQuery({
    queryKey: queryKeys.stats,
    queryFn: () => statsApi.getStats(),
  })
}

/**
 * Hook to fetch all unique search keywords.
 */
export function useKeywords() {
  return useQuery({
    queryKey: queryKeys.keywords,
    queryFn: () => keywordsApi.getKeywords(),
  })
}

/**
 * Hook to fetch scraper jobs.
 */
export function useScraperJobs(params: { page?: number; status?: string } = {}) {
  return useQuery({
    queryKey: queryKeys.scraperJobs(params),
    queryFn: () => scraperApi.getJobs(params),
  })
}

/**
 * Hook to fetch a single scraper job.
 */
export function useScraperJob(id: number) {
  return useQuery({
    queryKey: queryKeys.scraperJob(id),
    queryFn: () => scraperApi.getJob(id),
    enabled: !!id,
    refetchInterval: (query) => {
      // Auto-refresh running jobs every 5 seconds
      const data = query.state.data
      if (data?.data.status === 'running' || data?.data.status === 'pending') {
        return 5000
      }
      return false
    },
  })
}

/**
 * Hook to trigger a new scraper job.
 */
export function useTriggerScraper() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (options: { page_limit?: number } = {}) => scraperApi.triggerJob(options),
    onSuccess: () => {
      // Invalidate jobs and listings to refresh data
      queryClient.invalidateQueries({ queryKey: ['scraperJobs'] })
      queryClient.invalidateQueries({ queryKey: ['listings'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.stats })
    },
  })
}
