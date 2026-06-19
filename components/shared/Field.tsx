'use client'

import React from 'react'

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export function Field({ label, error, hint, className = '', ...props }: FieldProps) {
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="block text-xs font-medium text-[#D1D1DC] mb-1.5">
          {label}
        </label>
      )}
      <input className={`field ${error ? 'border-[#EF4444] focus:border-[#EF4444]' : ''}`} {...props} />
      {error && <p className="mt-1 text-xs text-[#EF4444]">{error}</p>}
      {hint && !error && <p className="mt-1 text-xs text-[#62627A]">{hint}</p>}
    </div>
  )
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
}

export function SelectField({ label, error, options, className = '', ...props }: SelectProps) {
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="block text-xs font-medium text-[#D1D1DC] mb-1.5">
          {label}
        </label>
      )}
      <select className={`field appearance-none ${error ? 'border-[#EF4444]' : ''}`} {...props}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-[#EF4444]">{error}</p>}
    </div>
  )
}
