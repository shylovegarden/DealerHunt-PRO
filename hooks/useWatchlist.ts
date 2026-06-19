import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@/lib/supabase'

type WatchlistItem = any & {
  listing: any
}

export function useWatchlist(filter: 'all' | 'price_drops' | 'ending_soon' = 'all') {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClientComponentClient()

  useEffect(() => {
    fetchWatchlist()
    
    // Set up real-time subscription
    const channel = supabase
      .channel('watchlist_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'watchlist' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setWatchlist(prev => [payload.new as WatchlistItem, ...prev])
          } else if (payload.eventType === 'DELETE') {
            setWatchlist(prev => prev.filter(item => item.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [filter])

  async function fetchWatchlist() {
    try {
      setLoading(true)
      const response = await fetch(`/api/watchlist?filter=${filter}`)
      if (!response.ok) throw new Error('Failed to fetch watchlist')
      
      const data = await response.json()
      setWatchlist(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch watchlist')
    } finally {
      setLoading(false)
    }
  }

  async function addToWatchlist(listingId: string, alertThreshold?: number, notes?: string) {
    try {
      const response = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: listingId, alert_threshold: alertThreshold, notes })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to add to watchlist')
      }

      return await response.json()
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to add to watchlist')
    }
  }

  async function removeFromWatchlist(listingId: string) {
    try {
      const response = await fetch(`/api/watchlist?listing_id=${listingId}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to remove from watchlist')
      
      setWatchlist(prev => prev.filter(item => item.listing.id !== listingId))
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to remove from watchlist')
    }
  }

  return {
    watchlist,
    loading,
    error,
    addToWatchlist,
    removeFromWatchlist,
    refetch: fetchWatchlist
  }
}
