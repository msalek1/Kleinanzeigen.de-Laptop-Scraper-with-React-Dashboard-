import { useState, useCallback, useEffect } from 'react'

const FAVORITES_KEY = 'kleinanzeigen_favorites'
const ALERTS_KEY = 'kleinanzeigen_price_alerts'

export interface PriceAlert {
  id: string
  keyword?: string
  maxPrice: number
  createdAt: string
  notified: boolean
}

/**
 * Hook for managing favorite listings with localStorage persistence.
 * Provides methods to add, remove, and check favorites.
 */
export function useFavorites() {
  const [favorites, setFavorites] = useState<number[]>([])

  // Load favorites from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(FAVORITES_KEY)
      if (stored) {
        setFavorites(JSON.parse(stored))
      }
    } catch (e) {
      console.error('Failed to load favorites:', e)
    }
  }, [])

  // Save favorites to localStorage whenever they change
  const saveFavorites = useCallback((newFavorites: number[]) => {
    setFavorites(newFavorites)
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites))
    } catch (e) {
      console.error('Failed to save favorites:', e)
    }
  }, [])

  const isFavorite = useCallback((listingId: number) => {
    return favorites.includes(listingId)
  }, [favorites])

  const addFavorite = useCallback((listingId: number) => {
    if (!favorites.includes(listingId)) {
      saveFavorites([...favorites, listingId])
    }
  }, [favorites, saveFavorites])

  const removeFavorite = useCallback((listingId: number) => {
    saveFavorites(favorites.filter(id => id !== listingId))
  }, [favorites, saveFavorites])

  const toggleFavorite = useCallback((listingId: number) => {
    if (favorites.includes(listingId)) {
      removeFavorite(listingId)
    } else {
      addFavorite(listingId)
    }
  }, [favorites, addFavorite, removeFavorite])

  const clearFavorites = useCallback(() => {
    saveFavorites([])
  }, [saveFavorites])

  return {
    favorites,
    isFavorite,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    clearFavorites,
    favoritesCount: favorites.length,
  }
}

/**
 * Hook for managing price alerts with localStorage persistence.
 * Allows users to set alerts for when listings below a certain price appear.
 */
export function usePriceAlerts() {
  const [alerts, setAlerts] = useState<PriceAlert[]>([])

  // Load alerts from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(ALERTS_KEY)
      if (stored) {
        setAlerts(JSON.parse(stored))
      }
    } catch (e) {
      console.error('Failed to load price alerts:', e)
    }
  }, [])

  // Save alerts to localStorage
  const saveAlerts = useCallback((newAlerts: PriceAlert[]) => {
    setAlerts(newAlerts)
    try {
      localStorage.setItem(ALERTS_KEY, JSON.stringify(newAlerts))
    } catch (e) {
      console.error('Failed to save price alerts:', e)
    }
  }, [])

  const addAlert = useCallback((keyword: string | undefined, maxPrice: number) => {
    const newAlert: PriceAlert = {
      id: `alert_${Date.now()}`,
      keyword,
      maxPrice,
      createdAt: new Date().toISOString(),
      notified: false,
    }
    saveAlerts([...alerts, newAlert])
    return newAlert
  }, [alerts, saveAlerts])

  const removeAlert = useCallback((alertId: string) => {
    saveAlerts(alerts.filter(a => a.id !== alertId))
  }, [alerts, saveAlerts])

  const markAlertNotified = useCallback((alertId: string) => {
    saveAlerts(alerts.map(a => 
      a.id === alertId ? { ...a, notified: true } : a
    ))
  }, [alerts, saveAlerts])

  const resetAlertNotification = useCallback((alertId: string) => {
    saveAlerts(alerts.map(a => 
      a.id === alertId ? { ...a, notified: false } : a
    ))
  }, [alerts, saveAlerts])

  const clearAlerts = useCallback(() => {
    saveAlerts([])
  }, [saveAlerts])

  // Check if any listing matches an alert
  const checkListingsForAlerts = useCallback((listings: Array<{ price_eur: number | null; search_keywords?: string[] }>) => {
    const matchingAlerts: PriceAlert[] = []
    
    for (const alert of alerts) {
      if (alert.notified) continue
      
      for (const listing of listings) {
        if (listing.price_eur === null) continue
        if (listing.price_eur > alert.maxPrice) continue
        
        // If alert has keyword, check if listing matches
        if (alert.keyword) {
          const listingKeywords = listing.search_keywords || []
          if (!listingKeywords.some(k => k.toLowerCase().includes(alert.keyword!.toLowerCase()))) {
            continue
          }
        }
        
        // Found a match
        matchingAlerts.push(alert)
        break
      }
    }
    
    return matchingAlerts
  }, [alerts])

  return {
    alerts,
    addAlert,
    removeAlert,
    markAlertNotified,
    resetAlertNotification,
    clearAlerts,
    checkListingsForAlerts,
    alertsCount: alerts.length,
    activeAlertsCount: alerts.filter(a => !a.notified).length,
  }
}
