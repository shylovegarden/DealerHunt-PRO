'use client'

import React from 'react'

interface ToastProps {
  message: string
  type?: 'success' | 'error' | 'info'
  onClose?: () => void
}

export function Toast({ message, type = 'info', onClose }: ToastProps) {
  const colorClasses = {
    success: 'bg-[rgba(16,185,129,.10)] text-[#10B981] border-[rgba(16,185,129,.20)]',
    error: 'bg-[rgba(239,68,68,.10)] text-[#EF4444] border-[rgba(239,68,68,.20)]',
    info: 'bg-[rgba(59,130,246,.10)] text-[#3B82F6] border-[rgba(59,130,246,.20)]',
  }

  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 rounded-xl px-4 py-3 border ${colorClasses[type]} animate-fade-in`}>
      <span className="text-sm font-medium">{message}</span>
      {onClose && (
        <button onClick={onClose} className="text-[#9898A8] hover:text-[#FAFAFA] transition-colors">
          ×
        </button>
      )}
    </div>
  )
}
