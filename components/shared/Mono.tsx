'use client'

import React from 'react'

interface MonoProps {
  children: React.ReactNode
  className?: string
  as?: keyof JSX.IntrinsicElements
}

export function Mono({ children, className = '', as: Component = 'span' }: MonoProps) {
  return (
    <Component className={`mono ${className}`}>
      {children}
    </Component>
  )
}
