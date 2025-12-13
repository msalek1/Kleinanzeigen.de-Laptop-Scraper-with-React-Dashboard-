import { useState, useEffect, useCallback, useRef } from 'react'

export interface ScraperProgress {
  status: 'running' | 'completed' | 'failed'
  current_keyword: string
  keyword_index: number
  total_keywords: number
  listings_found: number
  elapsed_seconds: number
  message: string
  timestamp: string
  completed?: boolean
  new_count?: number
  updated_count?: number
  error?: string
}

interface UseScraperSSEOptions {
  onProgress?: (progress: ScraperProgress) => void
  onComplete?: (progress: ScraperProgress) => void
  onError?: (error: string) => void
}

/**
 * Hook for subscribing to real-time scraper progress via Server-Sent Events.
 * Automatically connects when a job ID is provided and disconnects on cleanup.
 */
export function useScraperSSE(jobId: number | null, options: UseScraperSSEOptions = {}) {
  const [progress, setProgress] = useState<ScraperProgress | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  
  const { onProgress, onComplete, onError } = options

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setIsConnected(false)
  }, [])

  useEffect(() => {
    if (!jobId) {
      disconnect()
      setProgress(null)
      return
    }

    // Create EventSource for SSE
    const baseUrl = import.meta.env.VITE_API_URL || '/api/v1'
    const eventSource = new EventSource(`${baseUrl}/scraper/jobs/${jobId}/progress`)
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      setIsConnected(true)
      setError(null)
    }

    eventSource.addEventListener('connected', (event) => {
      console.log('SSE connected:', event.data)
      setIsConnected(true)
    })

    eventSource.addEventListener('progress', (event) => {
      try {
        const data: ScraperProgress = JSON.parse(event.data)
        setProgress(data)
        onProgress?.(data)
      } catch (e) {
        console.error('Failed to parse progress event:', e)
      }
    })

    eventSource.addEventListener('complete', (event) => {
      try {
        const data: ScraperProgress = JSON.parse(event.data)
        setProgress(data)
        onComplete?.(data)
        disconnect()
      } catch (e) {
        console.error('Failed to parse complete event:', e)
      }
    })

    eventSource.addEventListener('ping', () => {
      // Keepalive ping, no action needed
    })

    eventSource.onerror = (err) => {
      console.error('SSE error:', err)
      setError('Connection lost')
      onError?.('Connection lost')
      disconnect()
    }

    // Cleanup on unmount or job change
    return () => {
      disconnect()
    }
  }, [jobId, disconnect, onProgress, onComplete, onError])

  return {
    progress,
    isConnected,
    error,
    disconnect,
  }
}

/**
 * Hook for triggering scraper with real-time progress tracking.
 * Returns both the trigger function and progress state.
 */
export function useScraperWithProgress() {
  const [jobId, setJobId] = useState<number | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [result, setResult] = useState<ScraperProgress | null>(null)

  const { progress, isConnected, error, disconnect } = useScraperSSE(jobId, {
    onComplete: (finalProgress) => {
      setResult(finalProgress)
      setJobId(null)
    },
  })

  const startScraper = useCallback(async (pageLimit?: number, concurrency?: number) => {
    setIsStarting(true)
    setResult(null)
    
    try {
      const baseUrl = import.meta.env.VITE_API_URL || '/api/v1'
      const response = await fetch(`${baseUrl}/scraper/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page_limit: pageLimit, concurrency, stream: true }),
      })
      
      const data = await response.json()
      
      if (data.data?.id) {
        setJobId(data.data.id)
      }
    } catch (e) {
      console.error('Failed to start scraper:', e)
    } finally {
      setIsStarting(false)
    }
  }, [])

  const cancel = useCallback(() => {
    disconnect()
    setJobId(null)
  }, [disconnect])

  return {
    startScraper,
    cancel,
    progress,
    isStarting,
    isRunning: isConnected || !!jobId,
    result,
    error,
    jobId,
  }
}
