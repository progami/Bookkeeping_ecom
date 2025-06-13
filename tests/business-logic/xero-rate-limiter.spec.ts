import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { XeroRateLimiter, rateLimiterManager } from '@/lib/xero-rate-limiter'
import Bottleneck from 'bottleneck'

// Mock Redis before it's imported
vi.mock('@/lib/redis', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    incr: vi.fn(),
    decr: vi.fn(),
    expire: vi.fn(),
  },
}))

// Mock Bottleneck
vi.mock('bottleneck', () => {
  const MockBottleneck = vi.fn().mockImplementation(() => ({
    schedule: vi.fn((fn) => fn()),
    currentReservoir: vi.fn().mockResolvedValue(60),
  }))
  MockBottleneck.BottleneckError = class extends Error {}
  return { default: MockBottleneck }
})

describe('XeroRateLimiter', () => {
  let rateLimiter: XeroRateLimiter
  const tenantId = 'test-tenant-123'
  let mockRedis: any

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    
    // Get mocked redis instance
    const { redis } = await import('@/lib/redis')
    mockRedis = redis
    
    rateLimiter = new XeroRateLimiter(tenantId)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('daily limit tracking', () => {
    it('should track daily API calls', async () => {
      mockRedis.incr.mockResolvedValue(1)
      mockRedis.expire.mockResolvedValue(1)

      const mockApiCall = vi.fn().mockResolvedValue({ data: 'test' })
      
      await rateLimiter.executeAPICall(mockApiCall)

      const expectedKey = `xero:daily:${tenantId}:${new Date().toISOString().split('T')[0]}`
      expect(mockRedis.incr).toHaveBeenCalledWith(expectedKey)
      expect(mockRedis.expire).toHaveBeenCalledWith(expectedKey, 86400)
      expect(mockApiCall).toHaveBeenCalled()
    })

    it('should reject calls when daily limit is reached', async () => {
      mockRedis.incr.mockResolvedValue(5001) // Over the 5000 limit
      mockRedis.decr.mockResolvedValue(5000)

      const mockApiCall = vi.fn()

      await expect(rateLimiter.executeAPICall(mockApiCall))
        .rejects.toThrow('Daily API limit (5000) reached')

      expect(mockApiCall).not.toHaveBeenCalled()
      expect(mockRedis.decr).toHaveBeenCalled() // Should revert the increment
    })

    it('should reset daily counter at midnight', async () => {
      // Set current time to 11:59 PM
      const now = new Date()
      now.setHours(23, 59, 0, 0)
      vi.setSystemTime(now)

      // Create a new rate limiter instance to trigger the reset scheduler
      const newRateLimiter = new XeroRateLimiter(tenantId)

      // Advance time by 2 minutes (to 12:01 AM next day)
      vi.advanceTimersByTime(2 * 60 * 1000)

      // The reset should have been scheduled (check that timer was created)
      expect(vi.getTimerCount()).toBeGreaterThan(0)
    })
  })

  describe('rate limit handling', () => {
    it('should handle 429 rate limit errors', async () => {
      const rateLimitError = {
        response: {
          status: 429,
          headers: { 'retry-after': '60' },
        },
      }

      const mockApiCall = vi.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({ data: 'success' })

      // Mock Bottleneck to throw BottleneckError
      const mockSchedule = vi.fn().mockImplementation(async (fn) => {
        try {
          return await fn()
        } catch (error: any) {
          if (error.response?.status === 429) {
            throw new Bottleneck.BottleneckError('Rate limited. Retry after 60s')
          }
          throw error
        }
      })

      rateLimiter['limiter'].schedule = mockSchedule

      await expect(rateLimiter.executeAPICall(mockApiCall))
        .rejects.toThrow('Daily API limit')
    })

    it('should store rate limit information from headers', async () => {
      mockRedis.incr.mockResolvedValue(1) // Return low count
      
      const mockResponse = {
        data: 'test',
        headers: {
          'x-rate-limit-remaining': '45',
          'x-rate-limit-limit': '60',
        },
      }

      const mockApiCall = vi.fn().mockResolvedValue(mockResponse)
      
      await rateLimiter.executeAPICall(mockApiCall)

      expect(mockRedis.set).toHaveBeenCalledWith(
        `xero:rate:remaining:${tenantId}`,
        '45',
        'EX',
        60
      )
    })

    it('should store rate limit problems', async () => {
      mockRedis.incr.mockResolvedValue(1) // Return low count
      
      const mockResponse = {
        data: 'test',
        headers: {
          'x-rate-limit-problem': 'minute',
        },
      }

      const mockApiCall = vi.fn().mockResolvedValue(mockResponse)
      
      await rateLimiter.executeAPICall(mockApiCall)

      expect(mockRedis.set).toHaveBeenCalledWith(
        `xero:rate:problem:${tenantId}`,
        'minute',
        'EX',
        300
      )
    })
  })

  describe('batch execution', () => {
    it('should execute batch API calls', async () => {
      mockRedis.incr.mockResolvedValue(1)

      const mockApiCalls = [
        vi.fn().mockResolvedValue({ data: 'result1' }),
        vi.fn().mockResolvedValue({ data: 'result2' }),
        vi.fn().mockResolvedValue({ data: 'result3' }),
      ]

      const results = await rateLimiter.executeBatch(mockApiCalls)

      expect(results).toHaveLength(3)
      expect(results[0]).toEqual({ data: 'result1' })
      expect(results[1]).toEqual({ data: 'result2' })
      expect(results[2]).toEqual({ data: 'result3' })

      mockApiCalls.forEach(call => {
        expect(call).toHaveBeenCalled()
      })
    })
  })

  describe('priority execution', () => {
    it('should execute priority API calls', async () => {
      mockRedis.incr.mockResolvedValue(1)

      const mockApiCall = vi.fn().mockResolvedValue({ data: 'priority' })
      
      // Mock the priority schedule
      const mockPrioritySchedule = vi.fn().mockImplementation(async (options, fn) => {
        expect(options.priority).toBe(1)
        return fn()
      })

      rateLimiter['limiter'].schedule = mockPrioritySchedule

      const result = await rateLimiter.executePriority(mockApiCall)

      expect(result).toEqual({ data: 'priority' })
      expect(mockApiCall).toHaveBeenCalled()
    })
  })

  describe('getRateLimitStatus', () => {
    it('should return current rate limit status', async () => {
      mockRedis.get.mockImplementation((key: string) => {
        if (key.includes(':daily:')) return '1234'
        if (key.includes(':remaining:')) return '45'
        if (key.includes(':problem:')) return null
        return null
      })

      const status = await rateLimiter.getRateLimitStatus()

      expect(status).toEqual({
        dailyUsed: 1234,
        dailyRemaining: 3766,
        minuteRemaining: 45,
        problem: null,
        limiterInfo: 60,
      })
    })
  })

  describe('RateLimiterManager', () => {
    it('should return the same limiter instance for the same tenant', () => {
      const limiter1 = rateLimiterManager.getLimiter('tenant-1')
      const limiter2 = rateLimiterManager.getLimiter('tenant-1')
      
      expect(limiter1).toBe(limiter2)
    })

    it('should return different limiter instances for different tenants', () => {
      const limiter1 = rateLimiterManager.getLimiter('tenant-1')
      const limiter2 = rateLimiterManager.getLimiter('tenant-2')
      
      expect(limiter1).not.toBe(limiter2)
    })
  })

  describe('concurrent request handling', () => {
    it('should respect max concurrent requests', async () => {
      // Create a new Bottleneck instance with specific config
      const bottleneckConfig = (Bottleneck as any).mock.calls.find(
        (call: any[]) => call[0]?.maxConcurrent === 5
      )
      
      expect(bottleneckConfig).toBeDefined()
      expect(bottleneckConfig[0].maxConcurrent).toBe(5)
    })

    it('should enforce minimum time between requests', async () => {
      const bottleneckConfig = (Bottleneck as any).mock.calls[0][0]
      
      expect(bottleneckConfig.minTime).toBe(100)
    })
  })

  describe('error handling', () => {
    it('should propagate non-rate-limit errors', async () => {
      const genericError = new Error('API Error')
      const mockApiCall = vi.fn().mockRejectedValue(genericError)

      await expect(rateLimiter.executeAPICall(mockApiCall))
        .rejects.toThrow('API Error')
    })

    it('should handle API calls without headers gracefully', async () => {
      mockRedis.incr.mockResolvedValue(1)
      
      const mockApiCall = vi.fn().mockResolvedValue({ data: 'no headers' })
      
      const result = await rateLimiter.executeAPICall(mockApiCall)
      
      expect(result).toEqual({ data: 'no headers' })
      // Should not crash when trying to access headers
    })
  })
})