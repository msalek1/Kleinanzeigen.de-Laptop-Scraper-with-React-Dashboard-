import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, CheckCircle, XCircle, Zap } from 'lucide-react'
import { ScraperProgress } from '../hooks/useScraperSSE'

interface ScraperProgressPanelProps {
  progress: ScraperProgress | null
  isRunning: boolean
  isStarting: boolean
}

/**
 * Animated panel showing real-time scraper progress.
 * Displays current keyword, progress bar, and stats.
 */
export default function ScraperProgressPanel({ progress, isRunning, isStarting }: ScraperProgressPanelProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
  }

  const getProgressPercent = () => {
    if (!progress || progress.total_keywords === 0) return 0
    return Math.round((progress.keyword_index / progress.total_keywords) * 100)
  }

  const getStatusIcon = () => {
    if (isStarting) return <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
    if (!progress) return null
    
    switch (progress.status) {
      case 'running':
        return <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />
      default:
        return null
    }
  }

  const getStatusColor = () => {
    if (isStarting) return 'border-primary-500'
    if (!progress) return 'border-gray-200 dark:border-gray-700'
    
    switch (progress.status) {
      case 'running':
        return 'border-primary-500'
      case 'completed':
        return 'border-green-500'
      case 'failed':
        return 'border-red-500'
      default:
        return 'border-gray-200 dark:border-gray-700'
    }
  }

  if (!isRunning && !isStarting && !progress?.completed) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        exit={{ opacity: 0, y: -20, height: 0 }}
        className={`mb-8 max-w-2xl mx-auto overflow-hidden rounded-2xl border-2 ${getStatusColor()} bg-white dark:bg-gray-800 shadow-lg`}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {getStatusIcon()}
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">
                  {isStarting ? 'Starting Scraper...' : 
                   progress?.status === 'completed' ? 'Scraping Complete!' :
                   progress?.status === 'failed' ? 'Scraping Failed' :
                   'Scraping in Progress'}
                </h3>
                {progress && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {progress.message}
                  </p>
                )}
              </div>
            </div>
            
            {progress && (
              <div className="text-right">
                <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                  {progress.listings_found}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  listings found
                </div>
              </div>
            )}
          </div>

          {/* Progress bar */}
          {(isRunning || isStarting) && (
            <div className="mb-4">
              <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                <span>
                  {progress ? `Keyword ${progress.keyword_index + 1} of ${progress.total_keywords}` : 'Initializing...'}
                </span>
                <span>{getProgressPercent()}%</span>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-primary-500 to-emerald-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${getProgressPercent()}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
            </div>
          )}

          {/* Current keyword */}
          {progress?.current_keyword && progress.status === 'running' && (
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-yellow-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Currently scraping:
              </span>
              <span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm font-medium">
                {progress.current_keyword}
              </span>
            </div>
          )}

          {/* Stats row */}
          {progress && (
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-500 dark:text-gray-400">Elapsed:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatTime(progress.elapsed_seconds)}
                </span>
              </div>
              
              {progress.completed && progress.new_count !== undefined && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 dark:text-gray-400">New:</span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      +{progress.new_count}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 dark:text-gray-400">Updated:</span>
                    <span className="font-medium text-blue-600 dark:text-blue-400">
                      {progress.updated_count}
                    </span>
                  </div>
                </>
              )}
              
              {progress.error && (
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <XCircle className="w-4 h-4" />
                  <span>{progress.error}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
