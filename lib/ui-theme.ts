// Centralized UI theme configuration
export const theme = {
  colors: {
    primary: {
      default: 'emerald',
      finance: 'emerald',
      bookkeeping: 'emerald', 
      analytics: 'indigo',
      cashflow: 'cyan'
    },
    gradients: {
      primary: 'from-emerald-600/20 to-emerald-600/5',
      secondary: 'from-slate-600/20 to-slate-600/5',
      success: 'from-green-600/20 to-green-600/5',
      warning: 'from-amber-600/20 to-amber-600/5',
      danger: 'from-red-600/20 to-red-600/5',
      info: 'from-blue-600/20 to-blue-600/5'
    }
  },
  containers: {
    page: 'min-h-screen bg-slate-950',
    section: 'container mx-auto px-4 py-8',
    card: 'bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6',
    cardHover: 'hover:border-emerald-500/50 transition-all duration-300'
  },
  typography: {
    pageTitle: 'text-4xl font-bold text-white mb-2',
    pageSubtitle: 'text-gray-400',
    sectionTitle: 'text-2xl font-bold text-white mb-6',
    cardTitle: 'text-xl font-semibold text-white'
  },
  buttons: {
    primary: 'px-4 py-2 bg-emerald-600/20 text-emerald-400 rounded-lg hover:bg-emerald-600/30 transition-colors',
    secondary: 'px-4 py-2 bg-slate-800/50 text-white rounded-lg border border-slate-700 hover:border-emerald-500 transition-all',
    danger: 'px-4 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-colors',
    ghost: 'text-gray-400 hover:text-white transition-colors'
  },
  icons: {
    container: 'p-3 bg-emerald-600/20 rounded-xl',
    size: 'h-6 w-6',
    color: 'text-emerald-400'
  },
  loading: {
    container: 'flex items-center justify-center h-64',
    spinner: 'w-16 h-16',
    color: 'border-emerald-500'
  }
}

// Get theme-specific color
export function getThemeColor(page: 'finance' | 'bookkeeping' | 'analytics' | 'cashflow') {
  const color = theme.colors.primary[page]
  return {
    primary: `${color}-600`,
    light: `${color}-400`,
    dark: `${color}-700`,
    bg: `${color}-600/20`,
    border: `${color}-600/30`,
    hover: `${color}-500/50`
  }
}