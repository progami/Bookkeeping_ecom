import Decimal from 'decimal.js';

// Configure Decimal.js for financial calculations
// Set precision to handle currency with 4 decimal places for intermediate calculations
Decimal.set({ 
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -7,
  toExpPos: 20
});

/**
 * Financial calculation utilities using decimal.js for precision
 * All monetary values should be processed through these functions
 */

export class FinancialCalc {
  /**
   * Create a Decimal from a value, handling null/undefined safely
   */
  static decimal(value: number | string | null | undefined): Decimal {
    if (value === null || value === undefined) {
      return new Decimal(0);
    }
    return new Decimal(value);
  }

  /**
   * Add multiple values with precision
   */
  static add(...values: (number | string | null | undefined)[]): Decimal {
    return values.reduce(
      (sum, val) => sum.plus(this.decimal(val)),
      new Decimal(0)
    );
  }

  /**
   * Subtract values with precision
   */
  static subtract(minuend: number | string, ...subtrahends: (number | string | null | undefined)[]): Decimal {
    const result = this.decimal(minuend);
    return subtrahends.reduce(
      (diff, val) => diff.minus(this.decimal(val)),
      result
    );
  }

  /**
   * Multiply values with precision
   */
  static multiply(...values: (number | string | null | undefined)[]): Decimal {
    return values.reduce(
      (product, val) => product.times(this.decimal(val)),
      new Decimal(1)
    );
  }

  /**
   * Divide with precision and safe zero handling
   */
  static divide(dividend: number | string, divisor: number | string): Decimal | null {
    const divisorDecimal = this.decimal(divisor);
    if (divisorDecimal.isZero()) {
      return null; // Return null for division by zero
    }
    return this.decimal(dividend).dividedBy(divisorDecimal);
  }

  /**
   * Calculate percentage
   */
  static percentage(value: number | string, percentage: number | string): Decimal {
    return this.decimal(value).times(this.decimal(percentage)).dividedBy(100);
  }

  /**
   * Round to currency (2 decimal places)
   */
  static toCurrency(value: Decimal | number | string): string {
    return this.decimal(value).toFixed(2);
  }

  /**
   * Round to specified decimal places
   */
  static round(value: Decimal | number | string, decimals: number = 2): string {
    return this.decimal(value).toFixed(decimals);
  }

  /**
   * Convert to number (use with caution, only for display or when precision isn't critical)
   */
  static toNumber(value: Decimal | number | string): number {
    return this.decimal(value).toNumber();
  }

  /**
   * Compare two values
   */
  static compare(a: number | string, b: number | string): number {
    const decimalA = this.decimal(a);
    const decimalB = this.decimal(b);
    return decimalA.comparedTo(decimalB);
  }

  /**
   * Check if value is greater than another
   */
  static isGreaterThan(a: number | string, b: number | string): boolean {
    return this.compare(a, b) > 0;
  }

  /**
   * Check if value is less than another
   */
  static isLessThan(a: number | string, b: number | string): boolean {
    return this.compare(a, b) < 0;
  }

  /**
   * Check if values are equal
   */
  static isEqual(a: number | string, b: number | string): boolean {
    return this.compare(a, b) === 0;
  }

  /**
   * Calculate tax amount
   */
  static calculateTax(amount: number | string, taxRate: number | string): {
    taxAmount: string;
    totalWithTax: string;
    netAmount: string;
  } {
    const amountDecimal = this.decimal(amount);
    const taxAmount = this.percentage(amount, taxRate);
    const totalWithTax = amountDecimal.plus(taxAmount);

    return {
      taxAmount: this.toCurrency(taxAmount),
      totalWithTax: this.toCurrency(totalWithTax),
      netAmount: this.toCurrency(amountDecimal)
    };
  }

  /**
   * Calculate discount
   */
  static calculateDiscount(amount: number | string, discountPercent: number | string): {
    discountAmount: string;
    finalAmount: string;
  } {
    const amountDecimal = this.decimal(amount);
    const discountAmount = this.percentage(amount, discountPercent);
    const finalAmount = amountDecimal.minus(discountAmount);

    return {
      discountAmount: this.toCurrency(discountAmount),
      finalAmount: this.toCurrency(finalAmount)
    };
  }

  /**
   * Sum an array of values
   */
  static sum(values: (number | string | null | undefined)[]): string {
    const total = values.reduce(
      (sum, val) => sum.plus(this.decimal(val)),
      new Decimal(0)
    );
    return this.toCurrency(total);
  }

  /**
   * Calculate average
   */
  static average(values: (number | string | null | undefined)[]): string | null {
    if (values.length === 0) return null;
    
    const sum = values.reduce(
      (total, val) => total.plus(this.decimal(val)),
      new Decimal(0)
    );
    
    const avg = sum.dividedBy(values.length);
    return this.toCurrency(avg);
  }

  /**
   * Format currency with symbol
   */
  static formatCurrency(value: number | string | Decimal, symbol: string = '$'): string {
    const formatted = this.toCurrency(value);
    return `${symbol}${formatted}`;
  }

  /**
   * Parse currency string to Decimal
   */
  static parseCurrency(value: string): Decimal {
    // Remove currency symbols and commas
    const cleaned = value.replace(/[$,]/g, '').trim();
    return this.decimal(cleaned);
  }
}

// Export convenience functions
export const {
  decimal,
  add,
  subtract,
  multiply,
  divide,
  percentage,
  toCurrency,
  round,
  toNumber,
  compare,
  isGreaterThan,
  isLessThan,
  isEqual,
  calculateTax,
  calculateDiscount,
  sum,
  average,
  formatCurrency,
  parseCurrency
} = FinancialCalc;