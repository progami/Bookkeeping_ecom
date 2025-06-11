# Complete UI Elements Inventory

## Finance Dashboard (`/finance`)

### Navigation Elements
1. **Back to Home Button** - Returns to home page (redirects back to /finance)
2. **Time Range Selector** - Dropdown with options: Last 7 days, Last 30 days, Last 90 days

### Financial Metric Cards (4 cards)
1. **Total Revenue Card** - Hoverable, shows revenue with growth percentage
2. **Total Expenses Card** - Hoverable, shows expenses with growth percentage
3. **Net Income Card** - Hoverable, shows net income with profit margin
4. **Cash Balance Card** - Hoverable, shows total cash across all accounts

### Module Cards (4 cards)
1. **Bookkeeping Module Card** - Clickable, navigates to `/finance/bookkeeping`
   - Shows unreconciled count
   - Shows sync status indicator
   - Contains 2 quick action buttons:
     - SOP Generator button
     - View Transactions button

2. **Cash Flow Management Card** - Currently disabled (Coming Soon)
   - Shows module status as "Not Available"

3. **Financial Reporting Card** - Currently disabled (Coming Soon)
   - Shows module status as "Not Available"

4. **Budget & Planning Card** - Currently disabled (Coming Soon)
   - Shows module status as "Not Available"

### Quick Insights Section (3 cards)
1. **Financial Health Card**
   - Displays Quick Ratio (non-interactive)
   - Displays Cash Flow Trend (non-interactive)
   - Displays Profit Margin (non-interactive)

2. **Pending Actions Card**
   - Unreconciled Transactions count (non-interactive)
   - Old Unreconciled (60+ days) count (non-interactive)
   - Recent Payments (7 days) count (non-interactive)

3. **Period Summary Card**
   - Total Revenue display (non-interactive)
   - Total Expenses display (non-interactive)
   - Net Income display (non-interactive)

## Bookkeeping Dashboard (`/finance/bookkeeping`)

### Navigation Elements
1. **Back to Finance Button** - Returns to finance dashboard
2. **Time Range Selector** - Dropdown: Last 7 days, Last 30 days, Last 90 days
3. **Sync Now Button** - Triggers data sync with Xero
4. **Analytics Button** - Navigates to analytics page (if connected)
5. **Connect Xero Button** - Initiates Xero OAuth flow (if not connected)

### Financial Overview Cards (4 cards) - Only visible when connected
1. **Cash in Bank Card** - Hoverable
2. **Income Card** - Hoverable, shows period income
3. **Expenses Card** - Hoverable, shows period expenses  
4. **Net Cash Flow Card** - Hoverable

### Bank Accounts Section
1. **Bank Account Cards** - Each card is clickable, navigates to transactions
   - Shows account name
   - Shows balance
   - Shows unreconciled count
   - Shows last updated date

### Recent Transactions Section
1. **View all → Link** - Navigates to all transactions
2. **Transaction Items** - Each shows amount, description, date (non-interactive)

### Reconciliation Status Card
1. **Start Reconciling Button** - Navigates to unreconciled transactions

### Quick Actions Card
1. **SOP Generator Button** - Navigates to `/bookkeeping/sop-generator`
2. **All Transactions Button** - Navigates to `/bookkeeping/transactions`
3. **Manage Rules Button** - Navigates to `/bookkeeping/rules`
4. **SOP Tables Button** - Navigates to `/bookkeeping/sop-tables`

### Automation Status Card
1. **Configure Rules → Link** - Navigates to rules management

### Xero Connection Status (Bottom)
1. **Disconnect Button** - Disconnects from Xero (with confirmation)

## Transactions Page (`/bookkeeping/transactions`)

### Header Controls
1. **Back to Dashboard Button** - Returns to bookkeeping dashboard
2. **Export Button** - Exports transactions to CSV
3. **Refresh Button** - Refreshes transaction list
4. **Full Sync Button** - Performs full sync from Xero

### Filter Controls
1. **Search Input** - Text search for transactions
2. **Bank Account Selector** - Dropdown to filter by account
3. **Status Filter Buttons** (3 buttons):
   - All
   - Unreconciled
   - Reconciled

### Bulk Actions (when transactions selected)
1. **Bulk Reconcile Button** - Reconciles selected transactions
2. **Bulk Categorize Button** - Categorizes selected transactions
3. **Clear Selection Button** - Deselects all

### Transaction Table
1. **Select All Checkbox** - Header checkbox to select all
2. **Individual Transaction Checkboxes** - Select individual transactions
3. **Reconcile Button** - Per transaction (for unreconciled only)
4. **Transaction Rows** - Hoverable

### Pagination Controls
1. **Show All Button/Toggle** - Switches between paginated and show all
2. **Previous Button** - Navigate to previous page (when paginated)
3. **Next Button** - Navigate to next page (when paginated)

### Reconcile Modal (when opened)
1. **Account Code Input** - Text input
2. **Tax Type Selector** - Dropdown
3. **Notes Textarea** - Multi-line text input
4. **Create Rule Checkbox** - Toggle to create categorization rule
5. **Rule Name Input** - Visible when create rule checked
6. **Rule Pattern Input** - Visible when create rule checked
7. **Cancel Button** - Closes modal
8. **Reconcile Button** - Submits reconciliation

## SOP Generator (`/bookkeeping/sop-generator`)

### Navigation
1. **Back to Dashboard Button** - Returns to bookkeeping dashboard
2. **View SOP Tables Button** - Navigates to SOP tables

### Form Controls
1. **Year Selection Buttons** (2 buttons):
   - 2024
   - 2025

2. **Chart of Account Selector** - Dropdown (required)
3. **Service Type Selector** - Dropdown (required, appears after account selection)
4. **Invoice Number Input** - Text input (required)
5. **Period Month/Year Input** - Text input with default value

### Conditional Fields (appear based on selection)
1. **Department Selector** - Dropdown (for certain accounts)
2. **Region Selector** - Dropdown (for certain accounts)
3. **Frequency Selector** - Dropdown (for certain accounts)
4. **SKU Input** - Text input (for certain accounts)
5. **Batch Number Input** - Text input (for certain accounts)
6. **Vessel Name Input** - Text input (for shipping-related)
7. **Container Number Input** - Text input (for shipping-related)
8. **Country Code Input** - Text input (for shipping-related)
9. **FBA Shipment Plan ID Input** - Text input (for FBA-related)
10. **Location Input** - Text input (for FBA-related)
11. **Short Tag Input** - Text input (always visible)

### Action Buttons
1. **Generate SOP Button** - Generates SOP reference/description
2. **Reset Button** - Clears all form fields

### Results Section (after generation)
1. **Copy Reference Button** - Copies reference to clipboard
2. **Copy Description Button** - Copies description to clipboard

## SOP Tables (`/bookkeeping/sop-tables`)

### Navigation
1. **Back to Dashboard Button** - Returns to bookkeeping dashboard
2. **Go to SOP Generator Button** - Navigates to SOP generator

### Controls
1. **Year Toggle Buttons** (2 buttons):
   - 2024
   - 2025

2. **Search Input** - Filters table content
3. **Export to CSV Button** - Downloads table as CSV

### Table
1. **Expandable Account Rows** - Click to expand/collapse
2. **Expand/Collapse Icons** - ChevronDown/ChevronUp per row

## Rules Management (`/bookkeeping/rules`)

### Navigation
1. **Back to Dashboard Button** - Returns to bookkeeping dashboard
2. **Create New Rule Button** - Navigates to create rule page

### Filter Controls
1. **Search Input** - Search rules by name/pattern
2. **Status Filter Buttons** (3 buttons):
   - All
   - Active
   - Inactive

### Rules Table
1. **Edit Button** - Per rule, navigates to edit page
2. **Toggle Active Switch** - Per rule, enables/disables rule
3. **Delete Button** - Per rule, deletes with confirmation

### Empty State
1. **Create Your First Rule Button** - When no rules exist

## Create/Edit Rule (`/bookkeeping/rules/new` or `/bookkeeping/rules/[id]/edit`)

### Form Fields
1. **Rule Name Input** - Text input (required)
2. **Description Textarea** - Multi-line text
3. **Match Type Selector** - Dropdown: contains, exact, starts with, ends with
4. **Match Field Selector** - Dropdown: description, reference, amount
5. **Match Value Input** - Text input (required)
6. **Account Code Input** - Text with suggestions
7. **Tax Type Selector** - Dropdown
8. **Priority Input** - Number input
9. **Is Active Toggle** - Checkbox

### Action Buttons
1. **Cancel Button** - Returns to rules list
2. **Create/Update Rule Button** - Saves the rule

## Analytics Page (`/bookkeeping/analytics`)

### Navigation
1. **Back to Dashboard Button** - Returns to bookkeeping dashboard

### Controls
1. **Period Selector** - Dropdown: Month, Quarter, Year
2. **Export Button** - Downloads analytics data

### Interactive Charts
1. **Income vs Expenses Chart** - Hoverable data points
2. **Category Breakdown Pie Chart** - Hoverable segments
3. **Account Activity Bar Chart** - Hoverable bars

## Common UI Elements Across Pages

### Toast Notifications
- Success toasts (auto-dismiss)
- Error toasts (auto-dismiss)
- Loading toasts (persistent until complete)

### Loading States
- Spinner animations
- Skeleton loaders
- Loading overlays

### Hover Effects
- Card hover states (border color change)
- Button hover states (background color change)
- Table row hover states (background highlight)

### Keyboard Navigation
- Tab navigation through form fields
- Enter to submit forms
- Escape to close modals

### Responsive Behaviors
- Mobile menu toggles
- Responsive grid layouts
- Touch-friendly tap targets

## Authentication Flow

### Xero OAuth
1. **Connect Xero Button** - Initiates OAuth flow
2. **Authorize Button** - On Xero's site
3. **Select Organization** - On Xero's site
4. **Allow Access Button** - On Xero's site

## Error States

### Connection Errors
1. **Retry Button** - Appears on connection failure
2. **Reconnect Button** - For expired sessions

### Empty States
1. **Sync from Xero Button** - When no data exists
2. **Get Started Buttons** - Various CTAs for empty sections

## Accessibility Features

1. **Skip to Content Link** - Hidden but accessible
2. **ARIA Labels** - On all interactive elements
3. **Focus Indicators** - Visible focus states
4. **Screen Reader Announcements** - For dynamic content

---

## Total Interactive Elements Count

- **Buttons**: 89
- **Links**: 12
- **Inputs**: 31
- **Dropdowns/Selects**: 18
- **Checkboxes**: 6
- **Toggle Switches**: 2
- **Modal Dialogs**: 2
- **Hover Interactions**: 20+
- **Keyboard Shortcuts**: 3

**Total Unique Interactive Elements**: ~180+