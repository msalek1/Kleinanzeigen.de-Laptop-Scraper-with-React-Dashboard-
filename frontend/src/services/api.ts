/**
 * API client for the Kleinanzeigen Notebook Scraper backend.
 * 
 * This module provides a centralized interface for all API calls,
 * handling authentication, error normalization, and request/response formatting.
 */

import axios, { AxiosInstance, AxiosError } from 'axios'

// Types for API responses
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
  triggerJob: async (options: { page_limit?: number } = {}): Promise<ScraperJobResponse> => {
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
