import { cn } from "@/lib/utils"

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular' | 'card'
  width?: string | number
  height?: string | number
  animation?: 'pulse' | 'wave'
}

export function Skeleton({
  className,
  variant = 'text',
  width,
  height,
  animation = 'pulse',
  ...props
}: SkeletonProps) {
  const variants = {
    text: 'h-4 w-full rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
    card: 'rounded-2xl'
  }

  const animations = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer'
  }

  return (
    <div
      className={cn(
        "bg-slate-800/50",
        variants[variant],
        animations[animation],
        className
      )}
      style={{
        width: width,
        height: height || (variant === 'text' ? '1rem' : variant === 'circular' ? '3rem' : '100%')
      }}
      {...props}
    />
  )
}

// Composite skeleton components for common patterns
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6", className)}>
      <div className="flex items-center justify-between mb-4">
        <Skeleton variant="circular" width={48} height={48} />
        <Skeleton variant="text" width={60} height={12} />
      </div>
      <Skeleton variant="text" width={120} height={32} className="mb-2" />
      <Skeleton variant="text" width={80} height={16} />
    </div>
  )
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-4 pb-3 border-b border-slate-700">
        {[150, 200, 100, 100, 80].map((width, i) => (
          <Skeleton key={i} variant="text" width={width} height={16} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 py-3">
          {[150, 200, 100, 100, 80].map((width, j) => (
            <Skeleton key={j} variant="text" width={width} height={20} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonChart({ height = 300 }: { height?: number }) {
  return (
    <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6">
      <Skeleton variant="text" width={150} height={24} className="mb-6" />
      <Skeleton variant="rectangular" height={height} />
    </div>
  )
}