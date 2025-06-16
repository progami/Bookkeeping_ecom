# Xero Connection Flow Architecture

## Design Philosophy: Offline-First with Trust Indicators

### Core Principles

1. **Data Ownership**: Users should always access their synced data
2. **Transparency**: Clear indicators of data freshness and connection status
3. **Progressive Enhancement**: Additional features when connected
4. **Non-Blocking**: Never block access to existing data

## Connection States

### 1. No Data + No Connection (First Time User)
```
State: { hasData: false, hasActiveToken: false }
UI: Full-page empty state with "Connect to Xero" CTA
Access: No features available
```

### 2. Has Data + No Connection (Returning User, Expired Token)
```
State: { hasData: true, hasActiveToken: false }
UI: Warning banner + "Reconnect" button, full access to cached data
Access: All read-only features work with cached data
```

### 3. Has Data + Active Connection (Ideal State)
```
State: { hasData: true, hasActiveToken: true }
UI: Small "Connected" indicator with last sync time
Access: All features including sync, live reports
```

### 4. No Data + Active Connection (Just Connected)
```
State: { hasData: false, hasActiveToken: true }
UI: "Sync your data" prompt with progress indicator
Access: Sync features only
```

## Page-Specific Behavior

### Finance Dashboard (`/finance`)
- **Always Shows**: Cached data when available
- **Connection Banner**: "Reconnect to see latest transactions" if disconnected
- **Live Features**: Auto-refresh button, real-time sync (when connected)
- **Fallback**: Last synced data with timestamp

### Bookkeeping (`/bookkeeping`)
- **Always Shows**: All local transactions and data
- **Connection Banner**: Subtle "offline mode" indicator
- **Live Features**: Sync button, push to Xero (when connected)
- **Fallback**: Full functionality with local data

### Analytics (`/analytics`)
- **Always Shows**: All reports from local data
- **Connection Banner**: "Data as of [last sync date]"
- **Live Features**: Refresh data button (when connected)
- **Fallback**: Historical analytics work perfectly

### Cash Flow (`/cashflow`)
- **Always Shows**: Forecasts based on local data
- **Connection Banner**: "Reconnect for latest invoices"
- **Live Features**: Include pending Xero invoices (when connected)
- **Fallback**: Forecasting with existing data

## UI Components

### Connection Status Banner
```tsx
export function ConnectionStatusBanner() {
  const { hasActiveToken, lastSyncDate, isSyncing } = useAuth()
  
  if (hasActiveToken) {
    return (
      <div className="bg-emerald-900/20 border-emerald-800 px-4 py-2 flex items-center justify-between">
        <span className="text-sm text-emerald-400">
          Connected • Last synced {formatRelativeTime(lastSyncDate)}
        </span>
        <Button size="sm" onClick={handleSync} loading={isSyncing}>
          Sync Now
        </Button>
      </div>
    )
  }
  
  return (
    <div className="bg-amber-900/20 border-amber-800 px-4 py-2 flex items-center justify-between">
      <span className="text-sm text-amber-400">
        Working offline • Data from {formatDate(lastSyncDate)}
      </span>
      <Button size="sm" variant="warning" onClick={handleReconnect}>
        Reconnect to Xero
      </Button>
    </div>
  )
}
```

### Page Wrapper Pattern
```tsx
export function PageWrapper({ children, requiresLiveData = false }) {
  const { hasData, hasActiveToken } = useAuth()
  
  // First time user - no data at all
  if (!hasData) {
    return <FirstTimeUserEmpty />
  }
  
  // Has data but feature requires live connection
  if (requiresLiveData && !hasActiveToken) {
    return <ReconnectPrompt feature="live reports" />
  }
  
  // Normal flow - show page with appropriate banner
  return (
    <>
      <ConnectionStatusBanner />
      {children}
    </>
  )
}
```

## Implementation Checklist

### Phase 1: Standardize State Management
- [ ] Update AuthContext to track `lastSyncDate`
- [ ] Add `dataVersion` to track cache freshness
- [ ] Implement connection state helpers

### Phase 2: Update Page Components
- [ ] Finance: Remove blocking empty state, show cached data
- [ ] Analytics: Work with local data, add refresh button
- [ ] Bookkeeping: Standardize empty states
- [ ] Cash Flow: Show forecasts with cached data

### Phase 3: Add UI Indicators
- [ ] Implement ConnectionStatusBanner component
- [ ] Add "last synced" timestamps to all data displays
- [ ] Create consistent empty state components
- [ ] Add sync progress indicators

### Phase 4: Enhance Features
- [ ] Add manual sync button to all pages
- [ ] Implement auto-reconnect flow
- [ ] Add data freshness warnings for critical operations
- [ ] Create offline mode documentation

## Benefits

1. **User Trust**: Transparent about data freshness
2. **Continuity**: Never locked out of their own data
3. **Performance**: Faster page loads with cached data
4. **Reliability**: Works even with network issues
5. **Simplicity**: Consistent behavior across all pages

## Migration Path

1. Start with Bookkeeping page (already partially offline)
2. Update Finance to show cached data
3. Modify Analytics to work offline
4. Standardize Cash Flow behavior
5. Add consistent UI indicators
6. Update documentation

## Success Metrics

- Zero user lockouts due to expired tokens
- Reduced support tickets about "can't access data"
- Faster page load times (cached data)
- Increased user engagement (not blocked by connection issues)
- Clear understanding of data freshness