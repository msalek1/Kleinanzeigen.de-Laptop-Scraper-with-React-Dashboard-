/**
 * API client for the Kleinanzeigen Notebook Scraper backend.
 * 
 * This module provides a centralized interface for all API calls,
 * handling authentication, error normalization, and request/response formatting.
 */

import axios, { AxiosInstance, AxiosError } from 'axios'

// Types for API responses
export interface PriceHistoryEntry {
  price: number | null
  recorded_at: string
}

export interface Tag {
  id: number
  category: string
  value: string
  display_name: string
  count?: number
}

export interface Listing {
  id: number
  external_id: string
  url: string
  title: string
  price_eur: number | null
  price_negotiable: boolean
  location: {
    city: string | null
    state: string | null
  }
  description: string | null
  condition: string | null
  posted_at: string | null
  scraped_at: string | null
  image_url: string | null
  seller_type: string | null
  search_keywords: string[]
  item_type: string | null
  laptop_category: string | null
  tags: Tag[]
  price_history?: PriceHistoryEntry[]
}

export interface PaginationInfo {
  page: number
  per_page: number
  total_pages: number
  total_items: number
  has_next: boolean
  has_prev: boolean
}

export interface ListingsResponse {
  data: Listing[]
  pagination: PaginationInfo
}

export interface ListingResponse {
  data: Listing
}

export interface StatsData {
  total_listings: number
  average_price: number | null
  min_price: number | null
  max_price: number | null
  listings_by_city: Array<{ city: string; count: number }>
}

export interface StatsResponse {
  data: StatsData
}

export interface ScraperJob {
  id: number
  status: 'pending' | 'running' | 'completed' | 'failed'
  started_at: string | null
  completed_at: string | null
  pages_scraped: number
  listings_found: number
  listings_new: number
  listings_updated: number
  error_message: string | null
  created_at: string | null
}

export interface ScraperJobsResponse {
  data: ScraperJob[]
  pagination: PaginationInfo
}

export interface ScraperJobResponse {
  data: ScraperJob
  message?: string
  error?: string
}

export interface ListingsParams {
  page?: number
  per_page?: number
  q?: string
  min_price?: number
  max_price?: number
  location?: string
  condition?: string
  keyword?: string
  item_type?: 'laptop' | 'accessory' | 'other' | 'all'
  laptop_category?: 'gaming' | 'business' | 'ultrabook' | 'workstation' | '2in1' | 'all'
  tags?: string
  brand?: string
  exclude_archived?: boolean
  sort?: 'price' | 'posted_at' | 'scraped_at' | 'title'
  order?: 'asc' | 'desc'
}

export interface KeywordData {
  keyword: string
  count: number
}

export interface KeywordsResponse {
  data: KeywordData[]
}

export interface TagsResponse {
  data: Tag[]
}

export interface TagCategoryData {
  category: string
  tag_count: number
  usage_count: number
}

export interface TagCategoriesResponse {
  data: TagCategoryData[]
}

export interface LaptopCategoryData {
  category: string
  count: number
}

export interface LaptopCategoriesResponse {
  data: LaptopCategoryData[]
}

export interface ArchiveData {
  sync_code: string
  listing_ids: number[]
  count: number
}

export interface ArchiveResponse {
  data: ArchiveData
}

export interface ArchivedListingData {
  id: number
  listing_id: number
  sync_code: string
  archived_at: string
}

export interface ArchiveListingResponse {
  data: ArchivedListingData
  message: string
}

export interface BulkArchiveResponse {
  data: {
    archived_count: number
    total_requested: number
  }
  message: string
}

export interface GenerateSyncCodeResponse {
  data: {
    sync_code: string
  }
}

export interface ApiError {
  message: string
  status: number
  originalError?: unknown
}

// Admin config types
export interface ScraperConfig {
  id: number
  keywords: string
  keywords_list: string[]
  city: string
  categories: string
  categories_list: string[]
  update_interval_minutes: number
  page_limit: number
  is_active: boolean
  last_modified: string | null
}

export interface ScraperConfigResponse {
  data: ScraperConfig
  message?: string
}

export interface ScraperConfigUpdate {
  keywords?: string
  city?: string
  categories?: string
  update_interval_minutes?: number
  page_limit?: number
  is_active?: boolean
}

export interface Category {
  code: string
  name: string
  description: string
}

export interface City {
  slug: string
  name: string
  region: string
}

export interface CategoriesResponse {
  data: Category[]
}

export interface CitiesResponse {
  data: City[]
}

// Sync code storage key
const SYNC_CODE_KEY = 'klienz_sync_code'

/**
 * Get or generate sync code from localStorage
 */
export const getSyncCode = (): string | null => {
  return localStorage.getItem(SYNC_CODE_KEY)
}

/**
 * Set sync code in localStorage
 */
export const setSyncCode = (code: string): void => {
  localStorage.setItem(SYNC_CODE_KEY, code)
}

/**
 * Clear sync code from localStorage
 */
export const clearSyncCode = (): void => {
  localStorage.removeItem(SYNC_CODE_KEY)
}

/**
 * Create and configure the axios instance for API calls.
 */
const createApiClient = (): AxiosInstance => {
  const baseURL = import.meta.env.VITE_API_URL || '/api/v1'

  const client = axios.create({
    baseURL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  })

  // Request interceptor to add sync code header
  client.interceptors.request.use((config) => {
    const syncCode = getSyncCode()
    if (syncCode) {
      config.headers['X-Sync-Code'] = syncCode
    }
    return config
  })

  // Response interceptor for error handling
  client.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      const apiError: ApiError = {
        message: 'An unexpected error occurred',
        status: error.response?.status || 500,
        originalError: error,
      }

      if (error.response?.data && typeof error.response.data === 'object') {
        const data = error.response.data as Record<string, unknown>
        apiError.message = (data.message as string) || (data.error as string) || apiError.message
      } else if (error.message) {
        apiError.message = error.message
      }

      // Handle specific status codes
      if (error.response?.status === 401) {
        apiError.message = 'Authentication required'
        // Could redirect to login here
      } else if (error.response?.status === 403) {
        apiError.message = 'Access denied'
      } else if (error.response?.status === 404) {
        apiError.message = 'Resource not found'
      } else if (error.response?.status === 429) {
        apiError.message = 'Too many requests. Please wait and try again.'
      }

      return Promise.reject(apiError)
    }
  )

  return client
}

const apiClient = createApiClient()

/**
 * API functions for listings
 */
export const listingsApi = {
  /**
   * Get paginated list of listings with optional filters.
   */
  getListings: async (params: ListingsParams = {}): Promise<ListingsResponse> => {
    const response = await apiClient.get<ListingsResponse>('/listings', { params })
    return response.data
  },

  /**
   * Get a single listing by ID.
   */
  getListing: async (id: number): Promise<ListingResponse> => {
    const response = await apiClient.get<ListingResponse>(`/listings/${id}`)
    return response.data
  },
}

/**
 * API functions for statistics
 */
export const statsApi = {
  /**
   * Get aggregate statistics for listings.
   */
  getStats: async (): Promise<StatsResponse> => {
    const response = await apiClient.get<StatsResponse>('/stats')
    return response.data
  },
}

/**
 * API functions for search keywords
 */
export const keywordsApi = {
  /**
   * Get all unique search keywords and their counts.
   */
  getKeywords: async (): Promise<KeywordsResponse> => {
    const response = await apiClient.get<KeywordsResponse>('/keywords')
    return response.data
  },
}

/**
 * API functions for hardware tags
 */
export const tagsApi = {
  /**
   * Get all tags with optional category filter.
   */
  getTags: async (category?: string): Promise<TagsResponse> => {
    const params = category ? { category } : {}
    const response = await apiClient.get<TagsResponse>('/tags', { params })
    return response.data
  },

  /**
   * Get top N most popular tags for quick filters.
   */
  getPopularTags: async (limit: number = 20): Promise<TagsResponse> => {
    const response = await apiClient.get<TagsResponse>('/tags/popular', { params: { limit } })
    return response.data
  },

  /**
   * Get list of available tag categories.
   */
  getCategories: async (): Promise<TagCategoriesResponse> => {
    const response = await apiClient.get<TagCategoriesResponse>('/tags/categories')
    return response.data
  },
}

/**
 * API functions for laptop categories
 */
export const laptopCategoriesApi = {
  /**
   * Get list of laptop categories with counts.
   */
  getCategories: async (): Promise<LaptopCategoriesResponse> => {
    const response = await apiClient.get<LaptopCategoriesResponse>('/laptop-categories')
    return response.data
  },
}

/**
 * API functions for archive management
 */
export const archiveApi = {
  /**
   * Generate a new sync code.
   */
  generateSyncCode: async (): Promise<GenerateSyncCodeResponse> => {
    const response = await apiClient.post<GenerateSyncCodeResponse>('/archive/generate-code')
    return response.data
  },

  /**
   * Get all archived listing IDs for the current sync code.
   */
  getArchived: async (): Promise<ArchiveResponse> => {
    const response = await apiClient.get<ArchiveResponse>('/archive')
    return response.data
  },

  /**
   * Archive a listing.
   */
  archiveListing: async (listingId: number): Promise<ArchiveListingResponse> => {
    const response = await apiClient.post<ArchiveListingResponse>(`/listings/${listingId}/archive`)
    return response.data
  },

  /**
   * Unarchive a listing.
   */
  unarchiveListing: async (listingId: number): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>(`/listings/${listingId}/archive`)
    return response.data
  },

  /**
   * Bulk archive multiple listings.
   */
  bulkArchive: async (listingIds: number[]): Promise<BulkArchiveResponse> => {
    const response = await apiClient.post<BulkArchiveResponse>('/archive/bulk', { listing_ids: listingIds })
    return response.data
  },

  /**
   * Clear all archived listings for the current sync code.
   */
  clearArchive: async (): Promise<{ data: { cleared_count: number }; message: string }> => {
    const response = await apiClient.delete<{ data: { cleared_count: number }; message: string }>('/archive/clear')
    return response.data
  },
}

/**
 * API functions for scraper management
 */
export const scraperApi = {
  /**
   * Get list of scraper jobs.
   */
  getJobs: async (params: { page?: number; per_page?: number; status?: string } = {}): Promise<ScraperJobsResponse> => {
    const response = await apiClient.get<ScraperJobsResponse>('/scraper/jobs', { params })
    return response.data
  },

  /**
   * Get a single scraper job by ID.
   */
  getJob: async (id: number): Promise<ScraperJobResponse> => {
    const response = await apiClient.get<ScraperJobResponse>(`/scraper/jobs/${id}`)
    return response.data
  },

  /**
   * Trigger a new scraper job.
   * Uses extended timeout since scraping multiple keywords can take several minutes.
   */
  triggerJob: async (options: { page_limit?: number; concurrency?: number } = {}): Promise<ScraperJobResponse> => {
    const response = await apiClient.post<ScraperJobResponse>('/scraper/jobs', options, {
      timeout: 600000  // 10 minute timeout for scraper jobs
    })
    return response.data
  },
}

/**
 * Health check
 */
export const healthApi = {
  check: async (): Promise<{ status: string; timestamp: string }> => {
    const response = await apiClient.get('/health')
    return response.data
  },
}

/**
 * API functions for admin configuration
 */
export const adminApi = {
  /**
   * Get current scraper configuration.
   */
  getConfig: async (): Promise<ScraperConfigResponse> => {
    const response = await apiClient.get<ScraperConfigResponse>('/admin/config')
    return response.data
  },

  /**
   * Update scraper configuration.
   */
  updateConfig: async (config: ScraperConfigUpdate): Promise<ScraperConfigResponse> => {
    const response = await apiClient.put<ScraperConfigResponse>('/admin/config', config)
    return response.data
  },

  /**
   * Get available categories for scraping.
   */
  getCategories: async (): Promise<CategoriesResponse> => {
    const response = await apiClient.get<CategoriesResponse>('/admin/categories')
    return response.data
  },

  /**
   * Get available cities for filtering.
   */
  getCities: async (): Promise<CitiesResponse> => {
    const response = await apiClient.get<CitiesResponse>('/admin/cities')
    return response.data
  },
}

export default apiClient

