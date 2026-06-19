'use client'

import { useState } from 'react'
import { useWatchlist } from '@/hooks/useWatchlist'

interface SaveCarButtonProps {
  listingId: string
  className?: string
}

export function SaveCarButton({ listingId, className }: SaveCarButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [alertThreshold, setAlertThreshold] = useState(1000)
  const [notes, setNotes] = useState('')
  const [isSaved, setIsSaved] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  
  const { addToWatchlist } = useWatchlist()

  const handleSave = async () => {
    setIsLoading(true)
    try {
      await addToWatchlist(listingId, alertThreshold, notes)
      setIsSaved(true)
      setIsOpen(false)
    } catch (error) {
      console.error('Failed to save car:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isSaved) {
    return (
      <button disabled className={`bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md ${className}`}>
        ⭐ Saved
      </button>
    )
  }

  return (
    <div>
      <button
        onClick={() => setIsOpen(true)}
        className={`border border-gray-300 hover:border-gray-400 px-4 py-2 rounded-md ${className}`}
      >
        ⭐ Save Car
      </button>
      
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Save to Watchlist</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Alert me if price drops below
                </label>
                <input
                  type="number"
                  value={alertThreshold}
                  onChange={(e) => setAlertThreshold(Number(e.target.value))}
                  placeholder="1000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes about this car..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={isLoading}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {isLoading ? 'Saving...' : 'Save to Watchlist'}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="flex-1 border border-gray-300 px-4 py-2 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
