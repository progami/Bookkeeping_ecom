'use client'

/**
 * Form Component Library
 * Consistent, accessible form components with built-in validation states
 */

import { ReactNode, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { AlertCircle, Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { form as formTypography } from '@/lib/typography'

// Form Field Wrapper
interface FormFieldProps {
  children: ReactNode
  className?: string
}

export function FormField({ children, className }: FormFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {children}
    </div>
  )
}

// Form Label
interface FormLabelProps {
  children: ReactNode
  htmlFor?: string
  required?: boolean
  className?: string
}

export function FormLabel({ children, htmlFor, required, className }: FormLabelProps) {
  return (
    <label 
      htmlFor={htmlFor} 
      className={cn(formTypography.label, className)}
    >
      {children}
      {required && <span className="text-red-400 ml-1">*</span>}
    </label>
  )
}

// Form Input
interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
  success?: boolean
  icon?: ReactNode
}

export function FormInput({ 
  error, 
  success, 
  icon,
  className,
  ...props 
}: FormInputProps) {
  return (
    <div className="relative">
      {icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          {icon}
        </div>
      )}
      <input
        className={cn(
          'w-full px-4 py-2.5 bg-slate-800/50 border rounded-lg transition-all',
          'placeholder:text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed',
          formTypography.input,
          icon && 'pl-10',
          error && 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20',
          success && 'border-emerald-500/50 focus:border-emerald-500 focus:ring-emerald-500/20',
          !error && !success && 'border-slate-700 focus:border-blue-500 focus:ring-blue-500/20',
          'focus:outline-none focus:ring-4',
          className
        )}
        {...props}
      />
      {error && (
        <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-red-400" />
      )}
      {success && (
        <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-400" />
      )}
    </div>
  )
}

// Form Select
interface FormSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
  options: Array<{ value: string; label: string }>
  placeholder?: string
}

export function FormSelect({ 
  error, 
  options,
  className,
  placeholder = 'Select an option',
  ...props 
}: FormSelectProps) {
  return (
    <div className="relative">
      <select
        className={cn(
          'w-full px-4 py-2.5 pr-10 bg-slate-800/50 border rounded-lg transition-all appearance-none',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          formTypography.input,
          error && 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20',
          !error && 'border-slate-700 focus:border-blue-500 focus:ring-blue-500/20',
          'focus:outline-none focus:ring-4',
          className
        )}
        {...props}
      >
        <option value="" disabled>{placeholder}</option>
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
    </div>
  )
}

// Form Textarea
interface FormTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
  success?: boolean
}

export function FormTextarea({ 
  error, 
  success,
  className,
  ...props 
}: FormTextareaProps) {
  return (
    <textarea
      className={cn(
        'w-full px-4 py-2.5 bg-slate-800/50 border rounded-lg transition-all resize-none',
        'placeholder:text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed',
        formTypography.input,
        error && 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20',
        success && 'border-emerald-500/50 focus:border-emerald-500 focus:ring-emerald-500/20',
        !error && !success && 'border-slate-700 focus:border-blue-500 focus:ring-blue-500/20',
        'focus:outline-none focus:ring-4',
        className
      )}
      {...props}
    />
  )
}

// Form Helper Text
interface FormHelperProps {
  children: ReactNode
  error?: boolean
  className?: string
}

export function FormHelper({ children, error, className }: FormHelperProps) {
  return (
    <p className={cn(
      error ? formTypography.error : formTypography.helper,
      className
    )}>
      {children}
    </p>
  )
}

// Form Checkbox
interface FormCheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
}

export function FormCheckbox({ label, className, ...props }: FormCheckboxProps) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <input
        type="checkbox"
        className={cn(
          'w-5 h-5 bg-slate-800/50 border-slate-700 rounded transition-all cursor-pointer',
          'text-blue-600 focus:ring-4 focus:ring-blue-500/20 focus:ring-offset-0',
          'group-hover:border-slate-600',
          className
        )}
        {...props}
      />
      <span className={cn(formTypography.label, 'mb-0')}>
        {label}
      </span>
    </label>
  )
}

// Form Radio
interface FormRadioProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
}

export function FormRadio({ label, className, ...props }: FormRadioProps) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <input
        type="radio"
        className={cn(
          'w-5 h-5 bg-slate-800/50 border-slate-700 transition-all cursor-pointer',
          'text-blue-600 focus:ring-4 focus:ring-blue-500/20 focus:ring-offset-0',
          'group-hover:border-slate-600',
          className
        )}
        {...props}
      />
      <span className={cn(formTypography.label, 'mb-0')}>
        {label}
      </span>
    </label>
  )
}

// Form Switch/Toggle
interface FormSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
  className?: string
}

export function FormSwitch({ checked, onChange, label, disabled, className }: FormSwitchProps) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
          'focus:outline-none focus:ring-4 focus:ring-blue-500/20',
          checked ? 'bg-blue-600' : 'bg-slate-700',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-slate-100 transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </button>
      {label && (
        <span className={cn(formTypography.label, 'mb-0')}>
          {label}
        </span>
      )}
    </label>
  )
}

// Form Group (for inline fields)
interface FormGroupProps {
  children: ReactNode
  className?: string
}

export function FormGroup({ children, className }: FormGroupProps) {
  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4', className)}>
      {children}
    </div>
  )
}

// Form Section (for grouping related fields)
interface FormSectionProps {
  title: string
  description?: string
  children: ReactNode
  className?: string
}

export function FormSection({ title, description, children, className }: FormSectionProps) {
  return (
    <div className={cn('space-y-6', className)}>
      <div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {description && (
          <p className="text-sm text-gray-400 mt-1">{description}</p>
        )}
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  )
}