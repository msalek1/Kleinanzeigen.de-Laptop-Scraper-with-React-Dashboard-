/**
 * Admin page for managing scraper configuration.
 * 
 * Allows setting target keywords, update timer, city, and categories
 * for the Kleinanzeigen notebook scraper.
 */

import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { 
  Settings, 
  Clock, 
  MapPin, 
  Tag, 
  FolderOpen, 
  Save, 
  RefreshCw,
  Play,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { 
  adminApi, 
  scraperApi,
  ScraperConfig, 
  ScraperConfigUpdate, 
  Category, 
  City 
} from '../services/api'

export default function AdminPage() {
  const queryClient = useQueryClient()
  
  // Form state
  const [keywords, setKeywords] = useState('')
  const [city, setCity] = useState('')
  const [categories, setCategories] = useState('')
  const [updateInterval, setUpdateInterval] = useState(60)
  const [pageLimit, setPageLimit] = useState(5)
  const [isActive, setIsActive] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [scrapeStartTime, setScrapeStartTime] = useState<Date | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  
  // Fetch current config
  const { data: configData, isLoading: configLoading, error: configError } = useQuery({
    queryKey: ['adminConfig'],
    queryFn: () => adminApi.getConfig(),
  })
  
  // Fetch available categories
  const { data: categoriesData } = useQuery({
    queryKey: ['adminCategories'],
    queryFn: () => adminApi.getCategories(),
  })
  
  // Fetch available cities
  const { data: citiesData } = useQuery({
    queryKey: ['adminCities'],
    queryFn: () => adminApi.getCities(),
  })
  
  // Update config mutation
  const updateConfigMutation = useMutation({
    mutationFn: (config: ScraperConfigUpdate) => adminApi.updateConfig(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminConfig'] })
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 3000)
    },
    onError: () => {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    },
  })
  
  // Trigger scraper mutation
  const triggerScraperMutation = useMutation({
    mutationFn: () => scraperApi.triggerJob({ page_limit: pageLimit }),
    onMutate: () => {
      setScrapeStartTime(new Date())
      setElapsedTime(0)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scraperJobs'] })
      setScrapeStartTime(null)
    },
    onError: () => {
      setScrapeStartTime(null)
    },
  })
  
  // Timer for elapsed time during scraping
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    if (scrapeStartTime && triggerScraperMutation.isPending) {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - scrapeStartTime.getTime()) / 1000))
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [scrapeStartTime, triggerScraperMutation.isPending])
  
  // Calculate estimated time
  const keywordCount = keywords.split(',').filter(k => k.trim()).length || 1
  const estimatedSeconds = keywordCount * pageLimit * 8 // ~8 seconds per page (5s delay + scraping)
  const estimatedMinutes = Math.ceil(estimatedSeconds / 60)
  
  // Populate form when config loads
  useEffect(() => {
    if (configData?.data) {
      const config = configData.data
      setKeywords(config.keywords || '')
      setCity(config.city || '')
      setCategories(config.categories || '')
      setUpdateInterval(config.update_interval_minutes || 60)
      setPageLimit(config.page_limit || 5)
      setIsActive(config.is_active || false)
    }
  }, [configData])
  
  const handleSave = () => {
    setSaveStatus('saving')
    updateConfigMutation.mutate({
      keywords,
      city,
      categories,
      update_interval_minutes: updateInterval,
      page_limit: pageLimit,
      is_active: isActive,
    })
  }
  
  const handleTriggerScrape = () => {
    triggerScraperMutation.mutate()
  }
  
  const availableCategories: Category[] = categoriesData?.data || []
  const availableCities: City[] = citiesData?.data || []
  
  if (configLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading configuration...</span>
      </div>
    )
  }
  
  if (configError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
          <span className="text-red-700">Failed to load configuration. Please try again.</span>
        </div>
      </div>
    )
  }
  
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="w-7 h-7" />
          Scraper Administration
        </h1>
        <p className="text-gray-600 mt-1">
          Configure target keywords, update schedule, location, and categories for scraping.
        </p>
      </div>
      
      <div className="space-y-6">
        {/* Keywords Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Tag className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Target Keywords</h2>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            Enter comma-separated keywords to search for (e.g., "thinkpad, macbook, gaming laptop")
          </p>
          <textarea
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            rows={3}
            placeholder="notebook, laptop, thinkpad, macbook..."
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {keywords.split(',').filter(k => k.trim()).map((keyword, idx) => (
              <span 
                key={idx}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
              >
                {keyword.trim()}
              </span>
            ))}
          </div>
        </div>
        
        {/* Location Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-semibold text-gray-900">Target City</h2>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            Select a city to filter listings, or leave empty for all of Germany.
          </p>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            {availableCities.map((cityOption) => (
              <option key={cityOption.slug} value={cityOption.slug}>
                {cityOption.name} {cityOption.region && `(${cityOption.region})`}
              </option>
            ))}
          </select>
        </div>
        
        {/* Categories Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <FolderOpen className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900">Categories</h2>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            Select which categories to scrape.
          </p>
          <div className="space-y-2">
            {availableCategories.map((cat) => {
              const isSelected = categories.split(',').map(c => c.trim()).includes(cat.code)
              return (
                <label 
                  key={cat.code}
                  className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                    isSelected 
                      ? 'border-purple-500 bg-purple-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      const currentCats = categories.split(',').map(c => c.trim()).filter(Boolean)
                      if (e.target.checked) {
                        setCategories([...currentCats, cat.code].join(','))
                      } else {
                        setCategories(currentCats.filter(c => c !== cat.code).join(','))
                      }
                    }}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <div className="ml-3">
                    <span className="font-medium text-gray-900">{cat.name}</span>
                    <span className="text-gray-500 text-sm ml-2">({cat.code})</span>
                    <p className="text-xs text-gray-500">{cat.description}</p>
                  </div>
                </label>
              )
            })}
          </div>
        </div>
        
        {/* Timer Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-orange-600" />
            <h2 className="text-lg font-semibold text-gray-900">Update Schedule</h2>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            Set how often the scraper should automatically run (set to 0 to disable).
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Update Interval (minutes)
              </label>
              <input
                type="number"
                min="0"
                max="1440"
                value={updateInterval}
                onChange={(e) => setUpdateInterval(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                {updateInterval === 0 
                  ? 'Auto-update disabled' 
                  : `Scrapes every ${updateInterval} minutes (${(updateInterval / 60).toFixed(1)} hours)`
                }
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pages per Run
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={pageLimit}
                onChange={(e) => setPageLimit(parseInt(e.target.value) || 5)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Maximum pages to scrape per run (1-50)
              </p>
            </div>
          </div>
          
          <div className="mt-4">
            <label className="flex items-center cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-10 h-6 rounded-full transition-colors ${isActive ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform mt-1 ${isActive ? 'translate-x-5 ml-0.5' : 'translate-x-1'}`} />
                </div>
              </div>
              <span className="ml-3 text-sm font-medium text-gray-700">
                Enable automatic scraping
              </span>
            </label>
            {isActive && (
              <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                <CheckCircle className="w-4 h-4" />
                Auto-scraping is enabled
              </p>
            )}
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={handleSave}
            disabled={updateConfigMutation.isPending}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saveStatus === 'saving' ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : saveStatus === 'saved' ? (
              <>
                <CheckCircle className="w-5 h-5" />
                Saved!
              </>
            ) : saveStatus === 'error' ? (
              <>
                <AlertCircle className="w-5 h-5" />
                Error saving
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Configuration
              </>
            )}
          </button>
          
          <button
            onClick={handleTriggerScrape}
            disabled={triggerScraperMutation.isPending}
            className="flex-1 flex flex-col items-center justify-center gap-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {triggerScraperMutation.isPending ? (
              <>
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Scraping {keywordCount} keyword{keywordCount > 1 ? 's' : ''}...</span>
                </div>
                <span className="text-xs opacity-80">
                  {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')} elapsed 
                  (est. {estimatedMinutes} min)
                </span>
              </>
            ) : triggerScraperMutation.isSuccess ? (
              <>
                <CheckCircle className="w-5 h-5" />
                Scrape Completed!
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Play className="w-5 h-5" />
                  <span>Run Scraper Now</span>
                </div>
                <span className="text-xs opacity-80">
                  {keywordCount} keyword{keywordCount > 1 ? 's' : ''} × {pageLimit} pages ≈ {estimatedMinutes} min
                </span>
              </>
            )}
          </button>
        </div>
        
        {/* Scraper Result */}
        {triggerScraperMutation.isSuccess && triggerScraperMutation.data && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-medium text-green-800 mb-2">Scrape Completed</h3>
            <div className="text-sm text-green-700 space-y-1">
              <p>Status: {triggerScraperMutation.data.data.status}</p>
              <p>Listings found: {triggerScraperMutation.data.data.listings_found}</p>
              <p>New listings: {triggerScraperMutation.data.data.listings_new}</p>
              <p>Updated listings: {triggerScraperMutation.data.data.listings_updated}</p>
            </div>
          </div>
        )}
        
        {triggerScraperMutation.isError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <span className="text-red-700">
                Scraper failed to run. Check logs for details.
              </span>
            </div>
          </div>
        )}
        
        {/* Last Modified Info */}
        {configData?.data?.last_modified && (
          <p className="text-sm text-gray-500 text-center">
            Last updated: {new Date(configData.data.last_modified).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  )
}
