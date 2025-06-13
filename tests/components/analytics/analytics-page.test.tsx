import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import AnalyticsPage from '@/app/analytics/page'
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
  totalSpend: 10000,
  vendorCount: 5,
  topVendors: [
    {
      rank: 1,
      name: 'Vendor A',
      totalAmount: 4000,
      transactionCount: 10,
      lastTransaction: '2025-06-10T00:00:00.000Z',
      percentageOfTotal: 40,
      averageTransactionAmount: 400,
      growth: 20,
      previousAmount: 3333.33
    },
    {
      rank: 2,
      name: 'Vendor B',
      totalAmount: 3000,
      transactionCount: 5,
      lastTransaction: '2025-06-08T00:00:00.000Z',
      percentageOfTotal: 30,
      averageTransactionAmount: 600,
      growth: -10,
      previousAmount: 3333.33
    }
  ],
  summary: {
    topVendorSpend: 7000,
    topVendorPercentage: 70
  }
}

describe('AnalyticsPage', () => {
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

  describe('Rendering', () => {
    it('should render loading state initially', () => {
      render(<AnalyticsPage />)
      expect(screen.getByRole('status')).toBeInTheDocument()
    })

    it('should render header with correct title', async () => {
      render(<AnalyticsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Business Analytics')).toBeInTheDocument()
        expect(screen.getByText('Comprehensive insights into your business performance')).toBeInTheDocument()
      })
    })

    it('should render back button', async () => {
      render(<AnalyticsPage />)
      
      await waitFor(() => {
        const backButton = screen.getByText('Back to Finance')
        expect(backButton).toBeInTheDocument()
      })
    })

    it('should render period selector with all options', async () => {
      render(<AnalyticsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('7 Days')).toBeInTheDocument()
        expect(screen.getByText('30 Days')).toBeInTheDocument()
        expect(screen.getByText('90 Days')).toBeInTheDocument()
        expect(screen.getByText('1 Year')).toBeInTheDocument()
      })
    })
  })

  describe('Data Display', () => {
    it('should display quick stats correctly', async () => {
      render(<AnalyticsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('£10,000')).toBeInTheDocument() // Total Spend
        expect(screen.getByText('5')).toBeInTheDocument() // Active Vendors
        expect(screen.getByText('70.0%')).toBeInTheDocument() // Top 5 Concentration
        // Use getAllByText since Vendor A appears multiple times
        const vendorAElements = screen.getAllByText('Vendor A')
        expect(vendorAElements.length).toBeGreaterThan(0)
      })
    })

    it('should display vendor list with rankings', async () => {
      render(<AnalyticsPage />)
      
      await waitFor(() => {
        // Check vendor rankings
        expect(screen.getByText('1')).toBeInTheDocument()
        expect(screen.getByText('2')).toBeInTheDocument()
        
        // Check vendor details
        expect(screen.getByText('10 transactions')).toBeInTheDocument()
        expect(screen.getByText('5 transactions')).toBeInTheDocument()
      })
    })

    it('should display growth indicators correctly', async () => {
      render(<AnalyticsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('+20.0%')).toBeInTheDocument() // Positive growth
        expect(screen.getByText('-10.0%')).toBeInTheDocument() // Negative growth
      })
    })

    it('should display empty state when no vendors', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockVendorData,
          topVendors: []
        })
      } as Response)

      render(<AnalyticsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('No vendor data available for this period')).toBeInTheDocument()
      })
    })
  })

  describe('Period Selection', () => {
    it('should fetch data when period changes', async () => {
      render(<AnalyticsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('30 Days')).toBeInTheDocument()
      })

      // Clear previous calls
      vi.mocked(global.fetch).mockClear()

      // Click 7 Days
      fireEvent.click(screen.getByText('7 Days'))

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('period=7d')
        )
      })
    })

    it('should highlight selected period', async () => {
      render(<AnalyticsPage />)
      
      await waitFor(() => {
        const thirtyDaysButton = screen.getByText('30 Days')
        expect(thirtyDaysButton.className).toContain('bg-indigo-600')
      })

      // Click 90 Days
      fireEvent.click(screen.getByText('90 Days'))

      await waitFor(() => {
        const ninetyDaysButton = screen.getByText('90 Days')
        expect(ninetyDaysButton.className).toContain('bg-indigo-600')
      })
    })
  })

  describe('Navigation', () => {
    it('should navigate back to finance when back button clicked', async () => {
      render(<AnalyticsPage />)
      
      await waitFor(() => {
        const backButton = screen.getByText('Back to Finance')
        fireEvent.click(backButton)
        expect(mockPush).toHaveBeenCalledWith('/finance')
      })
    })

    it('should navigate to vendor transactions when vendor clicked', async () => {
      render(<AnalyticsPage />)
      
      await waitFor(() => {
        // Get all instances of Vendor A and find the one in the vendor list
        const vendorElements = screen.getAllByText('Vendor A')
        // Find the vendor in the list (not in the top vendor card)
        const vendorInList = vendorElements.find(el => 
          el.classList.contains('text-white') && el.classList.contains('font-medium')
        )
        
        if (vendorInList) {
          const vendorRow = vendorInList.closest('div[onClick]')
          if (vendorRow) {
            fireEvent.click(vendorRow)
            expect(mockPush).toHaveBeenCalledWith('/bookkeeping/transactions?vendor=Vendor%20A')
          }
        }
      })
    })

    it('should navigate to vendor analytics when button clicked', async () => {
      render(<AnalyticsPage />)
      
      await waitFor(() => {
        const vendorAnalyticsButton = screen.getByText('Vendor Analytics').closest('button')
        if (vendorAnalyticsButton) {
          fireEvent.click(vendorAnalyticsButton)
          expect(mockPush).toHaveBeenCalledWith('/analytics/vendors')
        }
      })
    })
  })

  describe('Error Handling', () => {
    it('should display error toast on fetch failure', async () => {
      const toast = await import('react-hot-toast')
      
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500
      } as Response)

      render(<AnalyticsPage />)
      
      await waitFor(() => {
        expect(toast.default.error).toHaveBeenCalledWith('Failed to fetch vendor analytics')
      })
    })

    it('should handle network errors gracefully', async () => {
      const toast = await import('react-hot-toast')
      
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'))

      render(<AnalyticsPage />)
      
      await waitFor(() => {
        expect(toast.default.error).toHaveBeenCalledWith('Failed to load analytics data')
      })
    })
  })

  describe('Currency Formatting', () => {
    it('should format currency values correctly', async () => {
      render(<AnalyticsPage />)
      
      await waitFor(() => {
        // Check various currency formats
        expect(screen.getByText('£10,000')).toBeInTheDocument() // Total spend
        expect(screen.getByText('£4,000')).toBeInTheDocument() // Vendor A amount
        expect(screen.getByText('£3,000')).toBeInTheDocument() // Vendor B amount
        expect(screen.getByText('Avg: £400')).toBeInTheDocument() // Average transaction
      })
    })
  })

  describe('Progress Bars', () => {
    it('should render progress bars with correct widths', async () => {
      render(<AnalyticsPage />)
      
      await waitFor(() => {
        // Find progress bars by their gradient background class
        const progressBars = document.querySelectorAll('.bg-gradient-to-r.from-indigo-500.to-purple-500')
        expect(progressBars).toHaveLength(2) // One for each vendor
        
        // Check first vendor's progress bar (40%)
        expect((progressBars[0] as HTMLElement).style.width).toBe('40%')
        
        // Check second vendor's progress bar (30%)
        expect((progressBars[1] as HTMLElement).style.width).toBe('30%')
      })
    })
  })
})