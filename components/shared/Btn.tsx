'use client'

import React from 'react'

type BtnVariant = 'primary' | 'ghost' | 'danger'
type BtnSize = 'sm' | 'md' | 'lg'

interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant
  size?: BtnSize
  loading?: boolean
  children: React.ReactNode
}

export function Btn({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}: BtnProps) {
  const sizeClasses = {
    sm: 'px-3 py-2 text-xs',
    md: 'px-4 py-3 text-sm',
    lg: 'px-6 py-4 text-base',
  }

  const variantClasses = {
    primary: 'btn-primary',
    ghost: 'btn-ghost',
    danger: 'bg-[rgba(239,68,68,.10)] text-[#EF4444] border border-[rgba(239,68,68,.20)] hover:bg-[rgba(239,68,68,.20)]',
  }

  return (
    <button
      disabled={disabled || loading}
      className={`btn ${sizeClasses[size]} ${variantClasses[variant]} disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      {loading && (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  )
}
