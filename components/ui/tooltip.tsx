'use client'

/**
 * Tooltip Component - Contextual help system
 * Provides progressive help with tooltips and contextual documentation
 */

import { ReactNode, useState, useRef, useEffect } from 'react'
import { HelpCircle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { typography } from '@/lib/typography'

// Types
export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right'
export type TooltipTrigger = 'hover' | 'click' | 'focus'
export type TooltipVariant = 'default' | 'help' | 'info' | 'warning'

interface TooltipProps {
  content: ReactNode
  children: ReactNode
  position?: TooltipPosition
  trigger?: TooltipTrigger
  variant?: TooltipVariant
  delay?: number
  maxWidth?: number
  className?: string
  showArrow?: boolean
}

export function Tooltip({
  content,
  children,
  position = 'top',
  trigger = 'hover',
  variant = 'default',
  delay = 200,
  maxWidth = 300,
  className,
  showArrow = true
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [actualPosition, setActualPosition] = useState(position)
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout>()

  // Calculate tooltip position to avoid viewport edges
  useEffect(() => {
    if (!isVisible || !tooltipRef.current || !triggerRef.current) return

    const tooltip = tooltipRef.current
    const trigger = triggerRef.current
    const triggerRect = trigger.getBoundingClientRect()
    const tooltipRect = tooltip.getBoundingClientRect()

    let newPosition = position

    // Check if tooltip goes outside viewport
    if (position === 'top' && triggerRect.top - tooltipRect.height < 0) {
      newPosition = 'bottom'
    } else if (position === 'bottom' && triggerRect.bottom + tooltipRect.height > window.innerHeight) {
      newPosition = 'top'
    } else if (position === 'left' && triggerRect.left - tooltipRect.width < 0) {
      newPosition = 'right'
    } else if (position === 'right' && triggerRect.right + tooltipRect.width > window.innerWidth) {
      newPosition = 'left'
    }

    setActualPosition(newPosition)
  }, [isVisible, position])

  const showTooltip = () => {
    if (trigger === 'hover') {
      timeoutRef.current = setTimeout(() => setIsVisible(true), delay)
    } else {
      setIsVisible(true)
    }
  }

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsVisible(false)
  }

  const toggleTooltip = () => {
    setIsVisible(!isVisible)
  }

  const triggerProps = {
    ...(trigger === 'hover' && {
      onMouseEnter: showTooltip,
      onMouseLeave: hideTooltip
    }),
    ...(trigger === 'click' && {
      onClick: toggleTooltip
    }),
    ...(trigger === 'focus' && {
      onFocus: showTooltip,
      onBlur: hideTooltip
    })
  }

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  }

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 -mt-px',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 -mb-px',
    left: 'left-full top-1/2 -translate-y-1/2 -ml-px',
    right: 'right-full top-1/2 -translate-y-1/2 -mr-px'
  }

  const arrowDirection = {
    top: 'border-t-slate-800 border-x-transparent border-b-transparent',
    bottom: 'border-b-slate-800 border-x-transparent border-t-transparent',
    left: 'border-l-slate-800 border-y-transparent border-r-transparent',
    right: 'border-r-slate-800 border-y-transparent border-l-transparent'
  }

  const variantStyles = {
    default: 'bg-slate-800 text-gray-200',
    help: 'bg-blue-600/90 text-white',
    info: 'bg-slate-700 text-gray-200',
    warning: 'bg-amber-600/90 text-white'
  }

  return (
    <div className="relative inline-block" ref={triggerRef}>
      <div {...triggerProps} className="cursor-help">
        {children}
      </div>
      
      {isVisible && (
        <div
          ref={tooltipRef}
          className={cn(
            'absolute z-50 px-3 py-2 rounded-lg shadow-xl',
            'animate-in fade-in-0 zoom-in-95 duration-100',
            positionClasses[actualPosition],
            variantStyles[variant],
            className
          )}
          style={{ maxWidth }}
        >
          <div className={cn(typography.caption, 'text-current')}>
            {content}
          </div>
          
          {showArrow && (
            <div
              className={cn(
                'absolute w-0 h-0 border-4',
                arrowClasses[actualPosition],
                arrowDirection[actualPosition]
              )}
            />
          )}
          
          {trigger === 'click' && (
            <button
              onClick={hideTooltip}
              className="absolute top-1 right-1 p-0.5 hover:bg-slate-700/50 rounded transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// Help Tooltip - Icon with tooltip
interface HelpTooltipProps {
  content: ReactNode
  position?: TooltipPosition
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function HelpTooltip({ 
  content, 
  position = 'top',
  size = 'sm',
  className 
}: HelpTooltipProps) {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6'
  }

  return (
    <Tooltip
      content={content}
      position={position}
      variant="help"
      trigger="hover"
    >
      <HelpCircle className={cn(sizes[size], 'text-gray-400 hover:text-gray-300 transition-colors', className)} />
    </Tooltip>
  )
}

// Info Tooltip - Inline info icon
interface InfoTooltipProps {
  content: ReactNode
  position?: TooltipPosition
  className?: string
}

export function InfoTooltip({ content, position = 'top', className }: InfoTooltipProps) {
  return (
    <Tooltip
      content={content}
      position={position}
      variant="info"
      trigger="hover"
      delay={100}
    >
      <Info className={cn('h-3.5 w-3.5 text-gray-500 hover:text-gray-400 transition-colors inline', className)} />
    </Tooltip>
  )
}

// Contextual Help Provider
interface ContextualHelpProps {
  title: string
  description: string
  learnMoreUrl?: string
  tips?: string[]
  position?: TooltipPosition
}

export function ContextualHelp({
  title,
  description,
  learnMoreUrl,
  tips = [],
  position = 'right'
}: ContextualHelpProps) {
  const content = (
    <div className="space-y-3 py-1">
      <div>
        <h4 className={cn(typography.label, 'text-white mb-1')}>{title}</h4>
        <p className={typography.caption}>{description}</p>
      </div>
      
      {tips.length > 0 && (
        <div className="space-y-1">
          <p className={cn(typography.overline, 'text-gray-400')}>Tips:</p>
          <ul className="space-y-1">
            {tips.map((tip, index) => (
              <li key={index} className={cn(typography.caption, 'flex items-start gap-1.5')}>
                <span className="text-blue-400 mt-0.5">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {learnMoreUrl && (
        <a
          href={learnMoreUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs font-medium transition-colors"
        >
          Learn more →
        </a>
      )}
    </div>
  )

  return (
    <Tooltip
      content={content}
      position={position}
      variant="help"
      trigger="click"
      maxWidth={350}
      showArrow={true}
    >
      <HelpCircle className="h-5 w-5 text-gray-400 hover:text-blue-400 transition-colors cursor-pointer" />
    </Tooltip>
  )
}

// Guided Tour Component
interface TourStep {
  target: string // CSS selector
  title: string
  content: string
  position?: TooltipPosition
}

interface GuidedTourProps {
  steps: TourStep[]
  onComplete?: () => void
  onSkip?: () => void
}

export function GuidedTour({ steps, onComplete, onSkip }: GuidedTourProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isActive, setIsActive] = useState(true)

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      setIsActive(false)
      onComplete?.()
    }
  }

  const handleSkip = () => {
    setIsActive(false)
    onSkip?.()
  }

  if (!isActive || steps.length === 0) return null

  const step = steps[currentStep]

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={handleSkip} />
      
      {/* Tour tooltip */}
      <div className="fixed z-50 max-w-sm p-4 bg-slate-800 rounded-xl shadow-2xl border border-slate-700">
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <h3 className={cn(typography.h6, 'text-white')}>{step.title}</h3>
            <button
              onClick={handleSkip}
              className="p-1 hover:bg-slate-700 rounded transition-colors"
            >
              <X className="h-4 w-4 text-gray-400" />
            </button>
          </div>
          
          <p className={typography.body}>{step.content}</p>
          
          <div className="flex items-center justify-between pt-2">
            <span className={cn(typography.caption, 'text-gray-500')}>
              Step {currentStep + 1} of {steps.length}
            </span>
            
            <div className="flex gap-2">
              {currentStep > 0 && (
                <button
                  onClick={() => setCurrentStep(currentStep - 1)}
                  className="px-3 py-1.5 text-sm font-medium text-gray-300 hover:text-white transition-colors"
                >
                  Back
                </button>
              )}
              <button
                onClick={handleNext}
                className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// Tooltip Provider for keyboard shortcuts
interface KeyboardTooltipProps {
  shortcut: string
  description: string
  children: ReactNode
}

export function KeyboardTooltip({ shortcut, description, children }: KeyboardTooltipProps) {
  const content = (
    <div className="flex items-center gap-3">
      <kbd className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs font-mono">
        {shortcut}
      </kbd>
      <span>{description}</span>
    </div>
  )

  return (
    <Tooltip
      content={content}
      position="bottom"
      trigger="hover"
      delay={500}
    >
      {children}
    </Tooltip>
  )
}