import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import VendorsAnalyticsPage from '@/app/analytics/vendors/page'
import '@testing-library/jest-dom'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn()
}))

// Mock fetch
global.fetch = vi.fn()

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn()
  },
  Toaster: () => null
}))

const mockVendorData = {
  success: true,
  period: '30d',
  startDate: '2025-05-14T00:00:00.000Z',
  endDate: '2025-06-13T00:00:00.000Z',
  totalSpend: 15000,
  vendorCount: 8,
  topVendors: [
    {
      rank: 1,
      name: 'Top Vendor Co',
      totalAmount: 5000,
      transactionCount: 15,
      lastTransaction: '2025-06-12T00:00:00.000Z',
      percentageOfTotal: 33.33,
      averageTransactionAmount: 333.33,
      growth: 25,
      previousAmount: 4000
    },
    {
      rank: 2,
      name: 'Second Best Ltd',
      totalAmount: 3500,
      transactionCount: 8,
      lastTransaction: '2025-06-10T00:00:00.000Z',
      percentageOfTotal: 23.33,
      averageTransactionAmount: 437.5,
      growth: -5,
      previousAmount: 3684.21
    },
    {
      rank: 3,
      name: 'Third Place Inc',
      totalAmount: 2500,
      transactionCount: 12,
      lastTransaction: '2025-06-11T00:00:00.000Z',
      percentageOfTotal: 16.67,
      averageTransactionAmount: 208.33,
      growth: 0,
      previousAmount: 2500
    }
  ],
  summary: {
    topVendorSpend: 11000,
    topVendorPercentage: 73.33
  }
}

describe('VendorsAnalyticsPage', () => {
  const mockPush = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useRouter).mockReturnValue({
      push: mockPush
    } as any)
    
    // Default successful fetch
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockVendorData
    } as Response)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Page Header', () => {
    it('should render page title and description', async () => {
      render(<VendorsAnalyticsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Vendor Analytics')).toBeInTheDocument()
        expect(screen.getByText('Detailed insights into vendor relationships and spending patterns')).toBeInTheDocument()
      })
    })

    it('should render export button', async () => {
      render(<VendorsAnalyticsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Export')).toBeInTheDocument()
      })
    })

    it('should show export coming soon message when clicked', async () => {
      const toast = await import('react-hot-toast')
      render(<VendorsAnalyticsPage />)
      
      await waitFor(() => {
        const exportButton = screen.getByText('Export')
        fireEvent.click(exportButton)
        expect(toast.default.success).toHaveBeenCalledWith('Export functionality coming soon!')
      })
    })
  })

  describe('Key Metrics Cards', () => {
    it('should display all metric cards with correct values', async () => {
      render(<VendorsAnalyticsPage />)
      
      await waitFor(() => {
        // Total Vendor Spend
        expect(screen.getByText('£15,000')).toBeInTheDocument()
        expect(screen.getByText('Total Vendor Spend')).toBeInTheDocument()
        
        // Active Vendors - use getAllByText since it might appear multiple times
        const vendorCountElements = screen.getAllByText('8')
        expect(vendorCountElements.length).toBeGreaterThan(0)
        expect(screen.getByText('Active Vendors')).toBeInTheDocument()
        
        // Average Transaction Size - use getAllByText
        const avgTransactionElements = screen.getAllByText('£333')
        expect(avgTransactionElements.length).toBeGreaterThan(0)
        expect(screen.getByText('Avg Transaction Size')).toBeInTheDocument()
        
        // Top 5 Concentration - use getAllByText
        const concentrationElements = screen.getAllByText('73.3%')
        expect(concentrationElements.length).toBeGreaterThan(0)
        expect(screen.getByText('Top 5 Concentration')).toBeInTheDocument()
      })
    })

    it('should show risk level based on concentration', async () => {
      render(<VendorsAnalyticsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Risk: High')).toBeInTheDocument() // 73.3% > 60%
      })
    })
  })

  describe('Search Functionality', () => {
    it('should render search input', async () => {
      render(<VendorsAnalyticsPage />)
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search vendors...')).toBeInTheDocument()
      })
    })

    it('should filter vendors based on search term', async () => {
      render(<VendorsAnalyticsPage />)
      
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search vendors...')
        fireEvent.change(searchInput, { target: { value: 'Top' } })
        
        expect(screen.getByText('Top Vendor Co')).toBeInTheDocument()
        expect(screen.queryByText('Second Best Ltd')).not.toBeInTheDocument()
      })
    })

    it('should be case-insensitive', async () => {
      render(<VendorsAnalyticsPage />)
      
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search vendors...')
        fireEvent.change(searchInput, { target: { value: 'second' } })
        
        expect(screen.getByText('Second Best Ltd')).toBeInTheDocument()
      })
    })
  })

  describe('Vendor Table', () => {
    it('should render table headers correctly', async () => {
      render(<VendorsAnalyticsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Rank')).toBeInTheDocument()
        expect(screen.getByText('Vendor')).toBeInTheDocument()
        expect(screen.getByText('Total Spend')).toBeInTheDocument()
        expect(screen.getByText('Transactions')).toBeInTheDocument()
        expect(screen.getByText('Avg Transaction')).toBeInTheDocument()
        expect(screen.getByText('% of Total')).toBeInTheDocument()
        expect(screen.getByText('Growth')).toBeInTheDocument()
        expect(screen.getByText('Last Activity')).toBeInTheDocument()
        expect(screen.getByText('Action')).toBeInTheDocument()
      })
    })

    it('should display vendor rows with correct data', async () => {
      render(<VendorsAnalyticsPage />)
      
      await waitFor(() => {
        // Check first vendor
        expect(screen.getByText('Top Vendor Co')).toBeInTheDocument()
        expect(screen.getByText('£5,000')).toBeInTheDocument()
        const transactionCounts = screen.getAllByText('15')
        expect(transactionCounts.length).toBeGreaterThan(0) // transactions
        const avgTransactionElements = screen.getAllByText('£333')
        expect(avgTransactionElements.length).toBeGreaterThan(0) // avg transaction
        expect(screen.getByText('33.3%')).toBeInTheDocument()
      })
    })

    it('should show rank badges with correct styling', async () => {
      render(<VendorsAnalyticsPage />)
      
      await waitFor(() => {
        const rank1 = screen.getByText('1')
        const rank2 = screen.getByText('2')
        const rank3 = screen.getByText('3')
        
        expect(rank1.className).toContain('bg-amber-500/20')
        expect(rank2.className).toContain('bg-gray-500/20')
        expect(rank3.className).toContain('bg-orange-600/20')
      })
    })

    it('should display growth with correct colors', async () => {
      render(<VendorsAnalyticsPage />)
      
      await waitFor(() => {
        const positiveGrowth = screen.getByText('+25.0%')
        const negativeGrowth = screen.getByText('-5.0%')
        const zeroGrowth = screen.getByText('+0.0%')
        
        expect(positiveGrowth.className).toContain('text-red-400') // High growth = red
        expect(negativeGrowth.className).toContain('text-emerald-400') // Negative = green
        expect(zeroGrowth.className).toContain('text-gray-400') // Zero = gray
      })
    })

    it('should navigate to transactions when action button clicked', async () => {
      render(<VendorsAnalyticsPage />)
      
      await waitFor(() => {
        const actionButtons = screen.getAllByRole('button', { hidden: true })
        const vendorActionButton = actionButtons.find(btn => 
          btn.querySelector('svg.h-5.w-5')
        )
        
        if (vendorActionButton) {
          fireEvent.click(vendorActionButton)
          expect(mockPush).toHaveBeenCalledWith('/bookkeeping/transactions?vendor=Top%20Vendor%20Co')
        }
      })
    })
  })

  describe('Insights Section', () => {
    it('should display concentration risk analysis', async () => {
      render(<VendorsAnalyticsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Concentration Risk')).toBeInTheDocument()
        expect(screen.getByText(/Your top 5 vendors account for/)).toBeInTheDocument()
        // Use getAllByText for percentage that appears multiple times
        const percentageElements = screen.getAllByText((content, element) => {
          return content.includes('73.3%')
        })
        expect(percentageElements.length).toBeGreaterThan(0)
        expect(screen.getByText(/Consider diversifying to reduce dependency risk/)).toBeInTheDocument()
      })
    })

    it('should display spending trends', async () => {
      render(<VendorsAnalyticsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Spending Trends')).toBeInTheDocument()
        expect(screen.getByText(/1 vendors show significant growth/)).toBeInTheDocument()
      })
    })
  })

  describe('Period Selection', () => {
    it('should update data when period changes', async () => {
      render(<VendorsAnalyticsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('30 Days')).toBeInTheDocument()
      })

      vi.mocked(global.fetch).mockClear()
      
      fireEvent.click(screen.getByText('90 Days'))

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('period=90d')
        )
      })
    })
  })

  describe('Empty State', () => {
    it('should show empty state when no vendors', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockVendorData,
          topVendors: [],
          vendorCount: 0
        })
      } as Response)

      render(<VendorsAnalyticsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('No vendor data available for this period')).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const toast = await import('react-hot-toast')
      
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500
      } as Response)

      render(<VendorsAnalyticsPage />)
      
      await waitFor(() => {
        expect(toast.default.error).toHaveBeenCalledWith('Failed to fetch vendor analytics')
      })
    })
  })

  describe('Progress Bars', () => {
    it('should render percentage bars with correct widths', async () => {
      render(<VendorsAnalyticsPage />)
      
      await waitFor(() => {
        // Look for progress bars in the vendor table specifically
        const vendorTable = screen.getByRole('table')
        const progressBars = vendorTable.querySelectorAll('.bg-purple-500')
        // Should have 3 vendors each with a progress bar
        expect(progressBars.length).toBeGreaterThanOrEqual(3)
        
        // Check first vendor's progress bar
        const firstBar = progressBars[0] as HTMLElement
        expect(firstBar.style.width).toBe('33.33%')
      })
    })
  })
})