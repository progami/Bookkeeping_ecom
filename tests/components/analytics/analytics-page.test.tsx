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
  vendors: [
    {
      name: 'Vendor A',
      totalSpend: 4000,
      transactionCount: 10,
      lastTransaction: '2025-06-10T00:00:00.000Z'
    },
    {
      name: 'Vendor B',
      totalSpend: 3000,
      transactionCount: 5,
      lastTransaction: '2025-06-08T00:00:00.000Z'
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
        const select = screen.getByRole('combobox')
        expect(select).toBeInTheDocument()
        expect(screen.getByText('7 days')).toBeInTheDocument()
        expect(screen.getByText('30 days')).toBeInTheDocument()
        expect(screen.getByText('90 days')).toBeInTheDocument()
        expect(screen.getByText('year')).toBeInTheDocument()
      })
    })
  })

  describe('Data Display', () => {
    it('should display quick stats correctly', async () => {
      render(<AnalyticsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('£7,000')).toBeInTheDocument() // Total Spend (calculated from vendors)
        // Check Active Vendors label exists and use getAllByText for the count
        expect(screen.getByText('Active Vendors')).toBeInTheDocument()
        const twos = screen.getAllByText('2')
        expect(twos.length).toBeGreaterThan(0) // Should find at least one "2"
        expect(screen.getByText('100.0%')).toBeInTheDocument() // Top 5 Concentration (both vendors are in top 5)
        // Use getAllByText since Vendor A appears multiple times
        const vendorAElements = screen.getAllByText('Vendor A')
        expect(vendorAElements.length).toBeGreaterThan(0)
      })
    })

    it('should display vendor list with rankings', async () => {
      render(<AnalyticsPage />)
      
      await waitFor(() => {
        // Check vendor rankings (use getAllByText since numbers appear multiple times)
        const ones = screen.getAllByText('1')
        expect(ones.length).toBeGreaterThan(0)
        const twos = screen.getAllByText('2')
        expect(twos.length).toBeGreaterThan(0)
        
        // Check vendor details (transaction counts)
        expect(screen.getByText('10')).toBeInTheDocument()
        expect(screen.getByText('5')).toBeInTheDocument()
      })
    })

    it('should display vendor percentages correctly', async () => {
      render(<AnalyticsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('57.1%')).toBeInTheDocument() // Vendor A percentage (4000/7000)
        expect(screen.getByText('42.9%')).toBeInTheDocument() // Vendor B percentage (3000/7000)
      })
    })

    it('should display empty state when no vendors', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockVendorData,
          vendors: []
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
        const select = screen.getByRole('combobox')
        expect(select).toBeInTheDocument()
      })

      // Clear previous calls
      vi.mocked(global.fetch).mockClear()

      // Change to 7 days
      const select = screen.getByRole('combobox')
      fireEvent.change(select, { target: { value: '7d' } })

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/v1/analytics/top-vendors')
      })
    })

    it('should update period selection', async () => {
      render(<AnalyticsPage />)
      
      await waitFor(() => {
        const select = screen.getByRole('combobox') as HTMLSelectElement
        expect(select.value).toBe('30d')
      })

      // Change to 90 days
      const select = screen.getByRole('combobox') as HTMLSelectElement
      fireEvent.change(select, { target: { value: '90d' } })

      await waitFor(() => {
        expect(select.value).toBe('90d')
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

    it('should display vendor analytics section', async () => {
      render(<AnalyticsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Vendor Analytics')).toBeInTheDocument()
        expect(screen.getByText('Deep dive into vendor relationships and spending patterns')).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle fetch failure silently', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500
      } as Response)

      render(<AnalyticsPage />)
      
      // Should still render without crashing
      await waitFor(() => {
        expect(screen.getByText('Business Analytics')).toBeInTheDocument()
      })
      
      consoleSpy.mockRestore()
    })

    it('should handle network errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'))

      render(<AnalyticsPage />)
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch vendor data:', expect.any(Error))
      })
      
      // Should still render without crashing
      expect(screen.getByText('Business Analytics')).toBeInTheDocument()
      
      consoleSpy.mockRestore()
    })
  })

  describe('Currency Formatting', () => {
    it('should format currency values correctly', async () => {
      render(<AnalyticsPage />)
      
      await waitFor(() => {
        // Check various currency formats
        expect(screen.getByText('£7,000')).toBeInTheDocument() // Total spend (calculated)
        expect(screen.getByText('£4,000')).toBeInTheDocument() // Vendor A amount
        expect(screen.getByText('£3,000')).toBeInTheDocument() // Vendor B amount
      })
    })
  })

})