import { prisma } from '@/lib/prisma'
import { structuredLogger } from '@/lib/logger'
import { Decimal } from '@prisma/client/runtime/library'

interface ExchangeRate {
  fromCurrency: string
  toCurrency: string
  rate: number
  effectiveDate: Date
}

export class CurrencyService {
  private static readonly BASE_CURRENCY = 'GBP'
  private static readonly CACHE_DURATION_HOURS = 24
  
  /**
   * Get exchange rate from one currency to another
   * First checks database cache, then fetches from Xero if needed
   */
  static async getExchangeRate(
    fromCurrency: string, 
    toCurrency: string,
    date?: Date
  ): Promise<number> {
    // Same currency = 1:1
    if (fromCurrency === toCurrency) return 1
    
    const effectiveDate = date || new Date()
    
    try {
      // Try to get from cache first
      const cachedRate = await this.getCachedRate(fromCurrency, toCurrency, effectiveDate)
      if (cachedRate) {
        return cachedRate.rate.toNumber()
      }
      
      // If not in cache, fetch from Xero or use fallback
      const freshRate = await this.fetchFreshRate(fromCurrency, toCurrency)
      
      // Cache the rate for future use
      await this.cacheRate({
        fromCurrency,
        toCurrency,
        rate: freshRate,
        effectiveDate
      })
      
      return freshRate
    } catch (error) {
      structuredLogger.error('Failed to get exchange rate', error, {
        component: 'currency-service',
        fromCurrency,
        toCurrency
      })
      
      // Return fallback rate
      return this.getFallbackRate(fromCurrency, toCurrency)
    }
  }
  
  /**
   * Convert amount from one currency to another
   */
  static async convert(
    amount: number | Decimal,
    fromCurrency: string,
    toCurrency: string,
    date?: Date
  ): Promise<number> {
    const numAmount = typeof amount === 'number' ? amount : amount.toNumber()
    const rate = await this.getExchangeRate(fromCurrency, toCurrency, date)
    return numAmount * rate
  }
  
  /**
   * Get cached rate from database
   */
  private static async getCachedRate(
    fromCurrency: string,
    toCurrency: string,
    date: Date
  ) {
    const cutoffTime = new Date()
    cutoffTime.setHours(cutoffTime.getHours() - this.CACHE_DURATION_HOURS)
    
    return await prisma.currencyRate.findFirst({
      where: {
        fromCurrency,
        toCurrency,
        effectiveDate: {
          gte: cutoffTime
        }
      },
      orderBy: {
        effectiveDate: 'desc'
      }
    })
  }
  
  /**
   * Cache exchange rate in database
   */
  private static async cacheRate(rate: ExchangeRate) {
    try {
      await prisma.currencyRate.create({
        data: {
          fromCurrency: rate.fromCurrency,
          toCurrency: rate.toCurrency,
          rate: new Decimal(rate.rate),
          effectiveDate: rate.effectiveDate,
          source: 'xero'
        }
      })
    } catch (error) {
      // Ignore duplicate key errors
      if (error instanceof Error && !error.message.includes('Unique constraint')) {
        throw error
      }
    }
  }
  
  /**
   * Fetch fresh rate from Xero API
   * Note: Xero doesn't provide a direct currency API endpoint
   * In production, this would integrate with Xe.com API or similar
   */
  private static async fetchFreshRate(
    fromCurrency: string,
    toCurrency: string
  ): Promise<number> {
    // For now, we'll use the fallback rates
    // In production, this would call Xe.com API or similar service
    structuredLogger.info('Using fallback rates - Xe.com integration not yet implemented', {
      component: 'currency-service',
      fromCurrency,
      toCurrency
    })
    
    return this.getFallbackRate(fromCurrency, toCurrency)
  }
  
  /**
   * Get fallback exchange rates
   * These are approximate rates for when API is unavailable
   */
  private static getFallbackRate(fromCurrency: string, toCurrency: string): number {
    // Convert everything to GBP first, then to target currency
    const toGBP: Record<string, number> = {
      'GBP': 1,
      'USD': 0.79,    // 1 USD = 0.79 GBP
      'EUR': 0.86,    // 1 EUR = 0.86 GBP
      'PKR': 0.0028,  // 1 PKR = 0.0028 GBP
      'SEK': 0.074,   // 1 SEK = 0.074 GBP
      'CAD': 0.58,    // 1 CAD = 0.58 GBP
      'AUD': 0.52,    // 1 AUD = 0.52 GBP
      'NZD': 0.49,    // 1 NZD = 0.49 GBP
      'INR': 0.0096,  // 1 INR = 0.0096 GBP
      'ZAR': 0.042,   // 1 ZAR = 0.042 GBP
    }
    
    const fromRate = toGBP[fromCurrency] || 1
    const toRate = toGBP[toCurrency] || 1
    
    // Convert: fromCurrency -> GBP -> toCurrency
    return fromRate / toRate
  }
  
  /**
   * Sync currency rates from Xero for all active currencies
   * This would be called during regular sync operations
   */
  static async syncCurrencyRates(currencies: string[]): Promise<void> {
    structuredLogger.info('Syncing currency rates', {
      component: 'currency-service',
      currencies
    })
    
    const uniqueCurrencies = [...new Set(currencies)]
    const effectiveDate = new Date()
    
    for (const fromCurrency of uniqueCurrencies) {
      for (const toCurrency of uniqueCurrencies) {
        if (fromCurrency !== toCurrency) {
          try {
            await this.getExchangeRate(fromCurrency, toCurrency, effectiveDate)
          } catch (error) {
            structuredLogger.error('Failed to sync rate', error, {
              component: 'currency-service',
              fromCurrency,
              toCurrency
            })
          }
        }
      }
    }
  }
  
  /**
   * Get all rates for a base currency
   */
  static async getAllRatesForCurrency(baseCurrency: string): Promise<Record<string, number>> {
    const rates: Record<string, number> = { [baseCurrency]: 1 }
    
    // Get all recent rates from database
    const recentRates = await prisma.currencyRate.findMany({
      where: {
        fromCurrency: baseCurrency,
        effectiveDate: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      orderBy: {
        effectiveDate: 'desc'
      },
      distinct: ['toCurrency']
    })
    
    for (const rate of recentRates) {
      rates[rate.toCurrency] = rate.rate.toNumber()
    }
    
    return rates
  }
}