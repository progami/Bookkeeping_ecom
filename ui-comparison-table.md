# UI Elements Comparison Table - Main Pages

## Overview
This document provides a comprehensive comparison of UI elements across the 4 main pages:
1. **Finance Page** - `/app/finance/page.tsx`
2. **Bookkeeping Page** - `/app/bookkeeping/page.tsx`
3. **Analytics Page** - `/app/analytics/page.tsx`
4. **Cash Flow Page** - `/app/cashflow/page.tsx`

## Page Layout & Container

| Element | Finance | Bookkeeping | Analytics | Cash Flow |
|---------|---------|-------------|-----------|-----------|
| **Background** | `bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950` | None (default) | `bg-slate-950` | None (default) |
| **Min Height** | `min-h-screen` | None | `min-h-screen` | None |
| **Container** | `container mx-auto px-4 py-8` | `container mx-auto px-4 py-8` | `container mx-auto px-4 py-8` | `container mx-auto px-4 py-8` |
| **Text Color** | Varies | Varies | `text-gray-100` | Varies |

## Header Section

| Element | Finance | Bookkeeping | Analytics | Cash Flow |
|---------|---------|-------------|-----------|-----------|
| **Back Button Text** | "Back to Home" | "Back to Home" | "Back to Finance" | "Back to Finance" |
| **Back Button Style** | `text-gray-400 hover:text-white transition-colors mb-4 inline-flex items-center group` | `text-gray-400 hover:text-white transition-colors mb-4 inline-flex items-center` | `text-gray-400 hover:text-white transition-colors mb-4 inline-flex items-center` | `text-gray-400 hover:text-white transition-colors mb-4 inline-flex items-center` |
| **Back Icon Animation** | `group-hover:-translate-x-1 transition-transform` | None | None | None |
| **Title Size** | `text-5xl` | `text-4xl` | `text-4xl` | `text-4xl` |
| **Title Style** | `font-bold text-white mb-3 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent` | `font-bold text-white mb-2` | `font-bold text-white mb-2` | `font-bold text-white mb-2` |
| **Subtitle Size** | `text-lg` | Default | Default | Default |
| **Subtitle Color** | `text-gray-400` | `text-gray-400` | `text-gray-400` | `text-gray-400` |

## Navigation Icons

| Element | Finance | Bookkeeping | Analytics | Cash Flow |
|---------|---------|-------------|-----------|-----------|
| **Back Icon** | `ArrowLeft` | `ArrowLeft` | `ArrowLeft` | `ArrowLeft` |
| **Icon Size** | `h-4 w-4 mr-2` | `h-4 w-4 mr-2` | `h-4 w-4 mr-2` | `h-4 w-4 mr-2` |

## Action Buttons & Controls

| Element | Finance | Bookkeeping | Analytics | Cash Flow |
|---------|---------|-------------|-----------|-----------|
| **Refresh Button** | Yes | Yes (Sync) | No | Yes (Sync) |
| **Refresh Style** | `px-4 py-2 bg-slate-800/50 text-white rounded-lg border border-slate-700 hover:border-emerald-500` | `px-4 py-2 bg-emerald-600/20 text-emerald-400 rounded-lg hover:bg-emerald-600/30` | N/A | `px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700` |
| **Time Range Select** | Yes | Yes | Yes | Yes (Forecast Days) |
| **Select Style** | `px-4 py-2 bg-slate-800/50 text-white rounded-lg border border-slate-700 focus:border-emerald-500` | `px-4 py-2 bg-slate-800/50 text-white rounded-lg border border-slate-700 focus:border-emerald-500` | `px-4 py-2 bg-slate-800/50 text-white rounded-lg border border-slate-700 focus:border-indigo-500` | `px-4 py-2 bg-slate-800/50 text-white rounded-lg border border-slate-700 focus:border-cyan-500` |
| **Connect Button** | Red theme | Green theme | N/A | N/A |

## Loading States

| Element | Finance | Bookkeeping | Analytics | Cash Flow |
|---------|---------|-------------|-----------|-----------|
| **Container Style** | `flex items-center justify-center h-96` | `flex items-center justify-center h-64` | `flex items-center justify-center h-64` | `flex items-center justify-center h-64` |
| **Spinner Size** | `w-20 h-20` | `w-16 h-16` | `w-16 h-16` | `w-16 h-16` |
| **Spinner Color** | `border-emerald-500` | `border-emerald-500` | `border-indigo-500` | `border-cyan-500` |
| **Animation** | `animate-pulse` + `animate-spin` | `animate-pulse` + `animate-spin` | `animate-pulse` + `animate-spin` | `animate-pulse` + `animate-spin` |

## Card/Container Styles

| Element | Finance | Bookkeeping | Analytics | Cash Flow |
|---------|---------|-------------|-----------|-----------|
| **Main Card Style** | `bg-gradient-to-br from-[color]/20 to-[color]/5 border border-[color]/30 rounded-2xl p-6` | `bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6` | `bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6` | `bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6` |
| **Hover Effect** | `hover:border-[color]/50 transition-all duration-300` | `hover:border-[color]/50 transition-all duration-300` | None | None |
| **Gradient Overlay** | Yes (on hover) | Yes (on hover) | None | None |
| **Border Radius** | `rounded-2xl` | `rounded-2xl` | `rounded-2xl` | `rounded-2xl` |

## Color Schemes by Feature

| Feature | Finance | Bookkeeping | Analytics | Cash Flow |
|---------|---------|-------------|-----------|-----------|
| **Primary Accent** | Emerald | Emerald | Indigo | Cyan |
| **Cash/Money** | Purple | Emerald | Indigo | Cyan |
| **Revenue/Positive** | Emerald/Green | Green | N/A | Green |
| **Expenses/Negative** | Red | Red | N/A | Red |
| **Profit/Net** | Cyan | Green | N/A | N/A |
| **Warning/Alert** | Amber | Amber | N/A | Amber |
| **Secondary Features** | Indigo, Pink | Purple, Cyan, Amber | Emerald, Purple, Cyan | Amber |

## Icon Usage

| Category | Finance | Bookkeeping | Analytics | Cash Flow |
|----------|---------|-------------|-----------|-----------|
| **Money/Finance** | `DollarSign`, `Wallet`, `CreditCard` | `Building2`, `DollarSign`, `CreditCard` | `DollarSign` | `DollarSign` |
| **Charts/Analytics** | `BarChart3`, `PieChart`, `LineChart` | `BarChart3` | `BarChart3` | Charts via Recharts |
| **Trends** | `TrendingUp`, `TrendingDown`, `Activity` | `TrendingUp`, `TrendingDown`, `Activity` | `TrendingUp` | `TrendingUp`, `TrendingDown` |
| **Documents** | `FileText`, `Receipt`, `BookOpen` | `FileText`, `Receipt`, `BookOpen` | N/A | `FileDown`, `FileUp` |
| **Actions** | `ArrowUpRight`, `RefreshCw` | `RefreshCw`, `Zap`, `Cloud`, `LogOut` | N/A | `RefreshCw`, `Download`, `Upload` |
| **Status/Alerts** | `AlertCircle`, `CheckCircle`, `Shield` | `AlertCircle`, `CheckCircle`, `AlertTriangle` | N/A | `AlertTriangle`, `Info` |
| **Navigation** | `ArrowLeft` | `ArrowLeft` | `ArrowLeft` | `ArrowLeft` |

## Button Styles

| Type | Finance | Bookkeeping | Analytics | Cash Flow |
|------|---------|-------------|-----------|-----------|
| **Primary Action** | `bg-red-600 text-white hover:bg-red-700` | `bg-green-600 text-white hover:bg-green-700` | N/A | `bg-cyan-600 text-white hover:bg-cyan-700` |
| **Secondary Action** | `bg-slate-800/50 text-white border border-slate-700 hover:border-emerald-500` | `bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30` | N/A | `bg-slate-700 text-white hover:bg-slate-600` |
| **Danger Action** | N/A | `bg-red-500/20 text-red-400 hover:bg-red-500/30` | N/A | N/A |
| **Ghost Button** | `text-gray-400 hover:text-white` | `text-gray-400 hover:text-white` | `text-gray-400 hover:text-white` | `text-gray-400 hover:text-white` |

## Typography

| Element | Finance | Bookkeeping | Analytics | Cash Flow |
|---------|---------|-------------|-----------|-----------|
| **Page Title** | `text-5xl font-bold` | `text-4xl font-bold` | `text-4xl font-bold` | `text-4xl font-bold` |
| **Section Title** | `text-2xl font-bold` | `text-2xl font-bold` | `text-xl font-semibold` | `text-xl font-semibold` |
| **Card Title** | `text-xl font-semibold` | `text-lg font-semibold` | `text-lg font-semibold` | `text-lg font-semibold` |
| **Values/Numbers** | `text-3xl font-bold` | `text-3xl font-bold` | `text-3xl font-bold` | `text-2xl font-bold` |
| **Labels** | `text-sm text-gray-400` | `text-sm text-gray-400` | `text-sm text-gray-400` | `text-sm text-gray-400` |

## Special Features

| Feature | Finance | Bookkeeping | Analytics | Cash Flow |
|---------|---------|-------------|-----------|-----------|
| **Health Score Card** | Yes | No | No | No |
| **Module Cards** | Yes (3 modules) | Yes (4 tools) | No | No |
| **Data Tables** | No | Yes (transactions) | Yes (vendors) | No |
| **Charts** | No | No | No | Yes (Recharts) |
| **Import/Export** | No | No | No | Yes |
| **Connection Status** | Yes (inline) | Yes (full section) | No | No |
| **Reconciliation UI** | No | Yes | No | No |

## Grid Layouts

| Section | Finance | Bookkeeping | Analytics | Cash Flow |
|---------|---------|-------------|-----------|-----------|
| **Metric Cards** | `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` | `grid-cols-1 md:grid-cols-4` | `grid-cols-1 md:grid-cols-4` | `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` |
| **Feature Cards** | `grid-cols-1 lg:grid-cols-2 xl:grid-cols-3` | `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` | `grid-cols-1 lg:grid-cols-2` | `grid-cols-1 lg:grid-cols-2` |
| **Main Layout** | Single column | `grid-cols-1 lg:grid-cols-3` (2:1 split) | Single column | Single column |

## Unique Elements by Page

### Finance Page
- Gradient background
- Health Score visualization
- Module status cards with activity indicators
- Developer tools section
- Animated hover effects with gradient overlays

### Bookkeeping Page
- Xero connection management UI
- Bank account listing
- Recent transactions feed
- Reconciliation status widget
- Tool cards with "NEW" badges

### Analytics Page
- Minimal design
- Vendor concentration metrics
- Data table with numbered rows
- "Coming soon" placeholder sections

### Cash Flow Page
- Interactive charts (Recharts)
- Scenario toggles
- Alert system
- Budget import/export functionality
- Daily/Weekly/Monthly view modes