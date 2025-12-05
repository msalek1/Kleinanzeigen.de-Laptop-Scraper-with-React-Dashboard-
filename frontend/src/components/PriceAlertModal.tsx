import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Bell, Plus, Trash2, AlertCircle } from 'lucide-react'
import { usePriceAlerts } from '../hooks/useFavorites'
import { useKeywords } from '../hooks/useApi'

interface PriceAlertModalProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * Modal for managing price alerts.
 * Users can create alerts for specific keywords with max price thresholds.
 */
export default function PriceAlertModal({ isOpen, onClose }: PriceAlertModalProps) {
  const { alerts, addAlert, removeAlert, resetAlertNotification } = usePriceAlerts()
  const { data: keywordsData } = useKeywords()
  
  const [keyword, setKeyword] = useState<string>('')
  const [maxPrice, setMaxPrice] = useState<string>('')
  const [error, setError] = useState<string>('')

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    const price = parseFloat(maxPrice)
    if (isNaN(price) || price <= 0) {
      setError('Please enter a valid price')
      return
    }
    
    addAlert(keyword || undefined, price)
    setKeyword('')
    setMaxPrice('')
  }, [keyword, maxPrice, addAlert])

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(price)
  }

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString))
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-x-4 top-[10%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
                  <Bell className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    Price Alerts
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Get notified when prices drop
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {/* Add new alert form */}
              <form onSubmit={handleSubmit} className="mb-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Keyword (optional)
                    </label>
                    <select
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 dark:text-white"
                    >
                      <option value="">All keywords</option>
                      {keywordsData?.data.map(({ keyword }) => (
                        <option key={keyword} value={keyword}>{keyword}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Maximum Price (€)
                    </label>
                    <input
                      type="number"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      placeholder="e.g., 500"
                      min="0"
                      step="10"
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 dark:text-white"
                    />
                  </div>
                  
                  {error && (
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      {error}
                    </div>
                  )}
                  
                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Alert
                  </button>
                </div>
              </form>
              
              {/* Existing alerts */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Active Alerts ({alerts.length})
                </h3>
                
                {alerts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No alerts set yet</p>
                    <p className="text-sm">Create an alert to get notified when prices drop</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          alert.notified
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                            : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 dark:text-white">
                              {alert.keyword || 'All listings'}
                            </span>
                            <span className="text-primary-600 dark:text-primary-400 font-semibold">
                              ≤ {formatPrice(alert.maxPrice)}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Created {formatDate(alert.createdAt)}
                            {alert.notified && (
                              <span className="ml-2 text-green-600 dark:text-green-400">
                                • Match found!
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {alert.notified && (
                            <button
                              onClick={() => resetAlertNotification(alert.id)}
                              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                            >
                              Reset
                            </button>
                          )}
                          <button
                            onClick={() => removeAlert(alert.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
