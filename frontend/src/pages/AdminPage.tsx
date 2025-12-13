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
  Play,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { 
  adminApi, 
  ScraperConfigUpdate, 
  Category, 
  City 
} from '../services/api'
import ScraperProgressPanel from '../components/ScraperProgressPanel'
import { useScraperWithProgress } from '../hooks/useScraperSSE'

export default function AdminPage() {
  const queryClient = useQueryClient()
  const {
    startScraper,
    progress: scraperProgress,
    result: scraperResult,
    isStarting: isScraperStarting,
    isRunning: isScraperRunning,
    error: scraperError,
  } = useScraperWithProgress()
  const progressForPanel = scraperProgress || scraperResult
  
  // Form state
  const [keywords, setKeywords] = useState('')
  const [city, setCity] = useState('')
  const [categories, setCategories] = useState('')
  const [updateInterval, setUpdateInterval] = useState(60)
  const [pageLimit, setPageLimit] = useState(5)
  const [concurrency, setConcurrency] = useState(2)
  const [isActive, setIsActive] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  
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
  
  // Invalidate caches when the streaming scraper run completes
  useEffect(() => {
    if (scraperResult?.status === 'completed') {
      queryClient.invalidateQueries({ queryKey: ['scraperJobs'] })
      queryClient.invalidateQueries({ queryKey: ['listings'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    }
  }, [queryClient, scraperResult?.status])
  
  // Calculate estimated time
  const keywordCount = keywords.split(',').filter(k => k.trim()).length || 1
  const categoryCount = categories.split(',').filter(c => c.trim()).length || 1
  const taskCount = keywordCount * categoryCount
  const estimatedSeconds = Math.ceil((taskCount * pageLimit * 8) / Math.max(1, concurrency)) // ~8 seconds per page (5s delay + scraping)
  const estimatedMinutes = Math.ceil(estimatedSeconds / 60)
  const elapsedSeconds = progressForPanel?.elapsed_seconds || 0
  const elapsedLabel = `${Math.floor(elapsedSeconds / 60)}:${(elapsedSeconds % 60).toString().padStart(2, '0')}`
  
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
    startScraper(pageLimit, concurrency)
  }

  const applyPreset = (preset: 'laptop' | 'general') => {
    if (preset === 'laptop') {
      setCategories('c278')
      if (!keywords.trim()) setKeywords('notebook,laptop')
      return
    }

    // Broader electronics profile
    setCategories('c161,c278,c225,c285')
    if (!keywords.trim()) setKeywords('notebook,laptop,pc,tablet')
  }
  
  const availableCategories: Category[] = categoriesData?.data || []
  const availableCities: City[] = citiesData?.data || []
  
  if (configLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading configuration...</span>
      </div>
    )
  }
  
  if (configError) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
        <div className="flex items-center">
          <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
          <span className="text-red-700 dark:text-red-300">Failed to load configuration. Please try again.</span>
        </div>
      </div>
    )
  }
  
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Settings className="w-7 h-7 text-primary-600 dark:text-primary-400" />
          Scraper Administration
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Configure target keywords, update schedule, location, and categories for scraping.
        </p>
      </div>

      <ScraperProgressPanel
        progress={progressForPanel}
        isRunning={isScraperRunning && progressForPanel?.status === 'running'}
        isStarting={isScraperStarting}
      />

      {scraperError && scraperResult?.status !== 'failed' && (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl text-yellow-800 dark:text-yellow-300 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Live progress connection lost. The job may still be running.
        </div>
      )}

      <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Presets</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Quickly switch between a laptop-focused setup and a broader electronics scrape.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => applyPreset('laptop')}
            className="flex-1 px-4 py-2.5 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 border border-primary-100 dark:border-primary-800 hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors font-medium"
          >
            Laptop Focus
          </button>
          <button
            type="button"
            onClick={() => applyPreset('general')}
            className="flex-1 px-4 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            General Electronics
          </button>
        </div>
      </div>
       
      <div className="space-y-6">
        {/* Keywords Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Tag className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Target Keywords</h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Enter comma-separated keywords to search for (e.g., "thinkpad, macbook, gaming laptop")
          </p>
          <textarea
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            rows={3}
            placeholder="notebook, laptop, thinkpad, macbook..."
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {keywords.split(',').filter(k => k.trim()).map((keyword, idx) => (
              <span 
                key={idx}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-200"
              >
                {keyword.trim()}
              </span>
            ))}
          </div>
        </div>
        
        {/* Location Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Target City</h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Select a city to filter listings, or leave empty for all of Germany.
          </p>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {availableCities.map((cityOption) => (
              <option key={cityOption.slug} value={cityOption.slug}>
                {cityOption.name} {cityOption.region && `(${cityOption.region})`}
              </option>
            ))}
          </select>
        </div>
        
        {/* Categories Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <FolderOpen className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Categories</h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
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
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' 
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
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
                    className="w-4 h-4 text-primary-600 border-gray-300 dark:border-gray-600 rounded focus:ring-primary-500"
                  />
                  <div className="ml-3">
                    <span className="font-medium text-gray-900 dark:text-white">{cat.name}</span>
                    <span className="text-gray-500 dark:text-gray-400 text-sm ml-2">({cat.code})</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{cat.description}</p>
                  </div>
                </label>
              )
            })}
          </div>
        </div>
        
        {/* Timer Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Update Schedule</h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Set how often the scraper should automatically run (set to 0 to disable).
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Update Interval (minutes)
              </label>
              <input
                type="number"
                min="0"
                max="1440"
                value={updateInterval}
                onChange={(e) => setUpdateInterval(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {updateInterval === 0 
                  ? 'Auto-update disabled' 
                  : `Scrapes every ${updateInterval} minutes (${(updateInterval / 60).toFixed(1)} hours)`
                }
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Pages per Run
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={pageLimit}
                onChange={(e) => setPageLimit(parseInt(e.target.value) || 5)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Maximum pages to scrape per run (1-50)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Workers (concurrency)
              </label>
              <input
                type="number"
                min="1"
                max="4"
                value={concurrency}
                onChange={(e) => {
                  const value = parseInt(e.target.value)
                  setConcurrency(Number.isFinite(value) ? Math.min(4, Math.max(1, value)) : 1)
                }}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Higher is faster, but increases block risk (1-4).
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
                <div className={`w-10 h-6 rounded-full transition-colors ${isActive ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform mt-1 ${isActive ? 'translate-x-5 ml-0.5' : 'translate-x-1'}`} />
                </div>
              </div>
              <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                Enable automatic scraping
              </span>
            </label>
            {isActive && (
              <p className="text-sm text-primary-600 dark:text-primary-400 mt-2 flex items-center gap-1">
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
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
            disabled={isScraperStarting || isScraperRunning}
            className="flex-1 flex flex-col items-center justify-center gap-1 px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl hover:opacity-95 focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isScraperStarting || isScraperRunning ? (
              <>
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Scraping {taskCount} task{taskCount > 1 ? 's' : ''}...</span>
                </div>
                <span className="text-xs opacity-80">
                  {elapsedLabel} elapsed (est. {estimatedMinutes} min)
                </span>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Play className="w-5 h-5" />
                  <span>Run Scraper Now</span>
                </div>
                <span className="text-xs opacity-80">
                  {taskCount} task{taskCount > 1 ? 's' : ''} x {pageLimit} pages ~ {estimatedMinutes} min
                </span>
              </>
            )}
          </button>
        </div>
        
        {/* Last Modified Info */}
        {configData?.data?.last_modified && (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
            Last updated: {new Date(configData.data.last_modified).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  )
}
