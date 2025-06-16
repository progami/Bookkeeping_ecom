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
    <div className={cn("bg-slate-800/30 border border-slate-700/50 rounded-2xl p-4 sm:p-6", className)}>
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
    <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-4 sm:p-6">
      <Skeleton variant="text" width={150} height={24} className="mb-6" />
      <Skeleton variant="rectangular" height={height} />
    </div>
  )
}

// Finance page specific skeletons
export function SkeletonMetricCard() {
  return (
    <div className="relative bg-slate-800/30 border border-slate-700/50 rounded-2xl p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 bg-slate-700/30 rounded-xl">
          <Skeleton variant="rectangular" width={24} height={24} />
        </div>
        <Skeleton variant="text" width={50} height={12} />
      </div>
      <Skeleton variant="text" width={100} height={36} className="mb-2" />
      <Skeleton variant="text" width={80} height={16} className="mb-2" />
      <Skeleton variant="text" width={120} height={12} />
    </div>
  )
}

export function SkeletonModuleCard() {
  return (
    <div className="relative bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 sm:p-6">
      <div className="absolute top-0 right-0 w-32 h-32 bg-slate-700/20 rounded-full blur-3xl" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-700/30 rounded-xl">
              <Skeleton variant="rectangular" width={24} height={24} />
            </div>
            <div>
              <Skeleton variant="text" width={120} height={24} className="mb-2" />
              <Skeleton variant="text" width={200} height={16} />
            </div>
          </div>
          <Skeleton variant="rectangular" width={20} height={20} />
        </div>
        
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-slate-900/50 rounded-lg p-3">
              <Skeleton variant="text" width={40} height={28} className="mb-1" />
              <Skeleton variant="text" width={60} height={12} />
            </div>
          ))}
        </div>
        
        <div className="flex flex-wrap gap-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} variant="text" width={80} height={24} className="rounded" />
          ))}
        </div>
      </div>
    </div>
  )
}

export function SkeletonHealthScore() {
  return (
    <div className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-3xl p-6 sm:p-8">
      <div className="flex items-center justify-between flex-wrap gap-6">
        <div>
          <Skeleton variant="text" width={250} height={32} className="mb-4" />
          <div className="flex items-baseline gap-3">
            <Skeleton variant="text" width={80} height={64} />
            <Skeleton variant="text" width={40} height={32} />
          </div>
          <Skeleton variant="text" width={300} height={16} className="mt-2" />
        </div>
        
        <div className="grid grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="text-center">
              <Skeleton variant="text" width={60} height={36} className="mx-auto mb-2" />
              <Skeleton variant="text" width={80} height={14} className="mx-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-8">
      {/* Health score skeleton */}
      <SkeletonHealthScore />
      
      {/* Metric cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {[...Array(4)].map((_, i) => (
          <SkeletonMetricCard key={i} />
        ))}
      </div>
      
      {/* Module cards skeleton */}
      <div>
        <Skeleton variant="text" width={200} height={32} className="mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <SkeletonModuleCard key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}

// Bookkeeping page skeletons
export function SkeletonTransactionRow() {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-slate-700/50">
      <Skeleton variant="text" width={100} height={16} />
      <Skeleton variant="text" width={200} height={16} className="flex-1" />
      <Skeleton variant="text" width={80} height={16} />
      <Skeleton variant="text" width={100} height={16} />
      <Skeleton variant="circular" width={32} height={32} />
    </div>
  )
}

export function SkeletonTransactionList() {
  return (
    <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl">
      <div className="p-4 sm:p-6 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <Skeleton variant="text" width={200} height={28} />
          <div className="flex gap-2">
            <Skeleton variant="rectangular" width={100} height={36} className="rounded-lg" />
            <Skeleton variant="rectangular" width={100} height={36} className="rounded-lg" />
          </div>
        </div>
      </div>
      <div>
        {[...Array(8)].map((_, i) => (
          <SkeletonTransactionRow key={i} />
        ))}
      </div>
    </div>
  )
}