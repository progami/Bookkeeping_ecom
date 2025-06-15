export default function RootLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-950">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-emerald-500/20 rounded-full animate-pulse" />
        <div className="absolute inset-0 w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  )
}