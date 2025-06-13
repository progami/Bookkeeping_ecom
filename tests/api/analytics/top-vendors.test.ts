import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/v1/analytics/top-vendors/route'
import { prisma } from '@/lib/prisma'

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    bankTransaction: {
      findMany: vi.fn()
    }
  }
}))

describe('/api/v1/analytics/top-vendors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const createMockRequest = (searchParams: Record<string, string> = {}) => {
    const url = new URL('http://localhost:3003/api/v1/analytics/top-vendors')
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
    return new NextRequest(url)
  }

  describe('Date Range Calculation', () => {
    it('should calculate correct date range for 7 days', async () => {
      const mockTransactions: any[] = []
      vi.mocked(prisma.bankTransaction.findMany).mockResolvedValue(mockTransactions)

      const request = createMockRequest({ period: '7d' })
      const response = await GET(request)
      const data = await response.json()

      expect(data.period).toBe('7d')
      
      const startDate = new Date(data.startDate)
      const endDate = new Date(data.endDate)
      const diffInDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      
      expect(diffInDays).toBe(7)
    })

    it('should calculate correct date range for 30 days', async () => {
      const mockTransactions: any[] = []
      vi.mocked(prisma.bankTransaction.findMany).mockResolvedValue(mockTransactions)

      const request = createMockRequest({ period: '30d' })
      const response = await GET(request)
      const data = await response.json()

      expect(data.period).toBe('30d')
      
      const startDate = new Date(data.startDate)
      const endDate = new Date(data.endDate)
      const diffInDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      
      expect(diffInDays).toBe(30)
    })

    it('should default to 30 days when no period specified', async () => {
      const mockTransactions: any[] = []
      vi.mocked(prisma.bankTransaction.findMany).mockResolvedValue(mockTransactions)

      const request = createMockRequest()
      const response = await GET(request)
      const data = await response.json()

      expect(data.period).toBe('30d')
    })
  })

  describe('Vendor Aggregation', () => {
    it('should correctly aggregate transactions by vendor', async () => {
      const mockTransactions = [
        { contactName: 'Vendor A', amount: -100, date: new Date() },
        { contactName: 'Vendor A', amount: -200, date: new Date() },
        { contactName: 'Vendor B', amount: -150, date: new Date() },
        { contactName: 'Vendor C', amount: -300, date: new Date() }
      ]
      
      vi.mocked(prisma.bankTransaction.findMany).mockResolvedValue(mockTransactions as any)

      const request = createMockRequest({ period: '30d' })
      const response = await GET(request)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.topVendors).toHaveLength(3)
      expect(data.topVendors[0].name).toBe('Vendor A') // Vendor A has total of 300 (100+200)
      expect(data.topVendors[0].totalAmount).toBe(300)
      expect(data.topVendors[1].name).toBe('Vendor C') // Vendor C has total of 300
      expect(data.topVendors[1].totalAmount).toBe(300)
    })

    it('should return only top 5 vendors', async () => {
      const mockTransactions = Array.from({ length: 10 }, (_, i) => ({
        contactName: `Vendor ${i}`,
        amount: -(100 + i * 10),
        date: new Date()
      }))
      
      vi.mocked(prisma.bankTransaction.findMany).mockResolvedValue(mockTransactions as any)

      const request = createMockRequest({ period: '30d' })
      const response = await GET(request)
      const data = await response.json()

      expect(data.topVendors).toHaveLength(5)
      expect(data.vendorCount).toBe(10)
    })

    it('should calculate correct percentages', async () => {
      const mockTransactions = [
        { contactName: 'Vendor A', amount: -400, date: new Date() },
        { contactName: 'Vendor B', amount: -600, date: new Date() }
      ]
      
      vi.mocked(prisma.bankTransaction.findMany).mockResolvedValue(mockTransactions as any)

      const request = createMockRequest({ period: '30d' })
      const response = await GET(request)
      const data = await response.json()

      expect(data.totalSpend).toBe(1000)
      expect(data.topVendors[0].percentageOfTotal).toBe(60)
      expect(data.topVendors[1].percentageOfTotal).toBe(40)
    })
  })

  describe('Growth Calculation', () => {
    it('should calculate growth rate correctly', async () => {
      const now = new Date()
      const thirtyDaysAgo = new Date(now)
      thirtyDaysAgo.setDate(now.getDate() - 30)
      const sixtyDaysAgo = new Date(now)
      sixtyDaysAgo.setDate(now.getDate() - 60)

      // Mock current period transactions
      vi.mocked(prisma.bankTransaction.findMany)
        .mockResolvedValueOnce([
          { contactName: 'Vendor A', amount: -500, date: now }
        ] as any)
        // Mock previous period transactions
        .mockResolvedValueOnce([
          { contactName: 'Vendor A', amount: -400, date: new Date(sixtyDaysAgo.getTime() + 1) }
        ] as any)

      const request = createMockRequest({ period: '30d' })
      const response = await GET(request)
      const data = await response.json()

      expect(data.topVendors[0].growth).toBe(25) // 500 vs 400 = 25% growth
    })

    it('should handle zero previous amount', async () => {
      const now = new Date()

      vi.mocked(prisma.bankTransaction.findMany)
        .mockResolvedValueOnce([
          { contactName: 'New Vendor', amount: -500, date: now }
        ] as any)
        .mockResolvedValueOnce([]) // No previous transactions

      const request = createMockRequest({ period: '30d' })
      const response = await GET(request)
      const data = await response.json()

      expect(data.topVendors[0].growth).toBe(100) // New vendor = 100% growth
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      vi.mocked(prisma.bankTransaction.findMany).mockRejectedValue(new Error('Database error'))

      const request = createMockRequest({ period: '30d' })
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch top vendors')
      expect(data.details).toBe('Database error')
    })
  })

  describe('Edge Cases', () => {
    it('should handle no transactions', async () => {
      vi.mocked(prisma.bankTransaction.findMany).mockResolvedValue([])

      const request = createMockRequest({ period: '30d' })
      const response = await GET(request)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.topVendors).toHaveLength(0)
      expect(data.totalSpend).toBe(0)
      expect(data.vendorCount).toBe(0)
    })

    it('should filter out null contact names', async () => {
      // The API filters null contact names in the query itself, so we simulate that here
      const mockTransactions = [
        { contactName: 'Vendor A', amount: -100, date: new Date() },
        { contactName: 'Vendor B', amount: -150, date: new Date() }
      ]
      
      vi.mocked(prisma.bankTransaction.findMany).mockResolvedValue(mockTransactions as any)

      const request = createMockRequest({ period: '30d' })
      const response = await GET(request)
      const data = await response.json()

      expect(data.topVendors).toHaveLength(2)
      expect(data.vendorCount).toBe(2)
      
      // Verify the findMany was called with the correct filter
      expect(prisma.bankTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            contactName: {
              not: null
            }
          })
        })
      )
    })

    it('should handle only SPEND transactions', async () => {
      const mockFindMany = vi.mocked(prisma.bankTransaction.findMany)
      mockFindMany.mockResolvedValue([])

      const request = createMockRequest({ period: '30d' })
      await GET(request)

      // Check that findMany was called with type: 'SPEND' filter
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'SPEND'
          })
        })
      )
    })
  })

  describe('Summary Calculations', () => {
    it('should calculate summary correctly', async () => {
      const mockTransactions = [
        { contactName: 'Vendor A', amount: -250, date: new Date() },
        { contactName: 'Vendor B', amount: -250, date: new Date() },
        { contactName: 'Vendor C', amount: -200, date: new Date() },
        { contactName: 'Vendor D', amount: -150, date: new Date() },
        { contactName: 'Vendor E', amount: -100, date: new Date() },
        { contactName: 'Vendor F', amount: -50, date: new Date() }
      ]
      
      vi.mocked(prisma.bankTransaction.findMany).mockResolvedValue(mockTransactions as any)

      const request = createMockRequest({ period: '30d' })
      const response = await GET(request)
      const data = await response.json()

      expect(data.totalSpend).toBe(1000)
      expect(data.summary.topVendorSpend).toBe(950) // Top 5 vendors
      expect(data.summary.topVendorPercentage).toBe(95) // 950/1000 * 100
    })
  })
})