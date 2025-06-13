// Transaction matching utilities
export interface TransactionMatch {
  bankTransactionId: string;
  xeroTransactionId: string;
  confidence: number;
  matchType: 'exact' | 'fuzzy' | 'manual';
}

export function matchTransactions(
  bankTransactions: any[],
  xeroTransactions: any[]
): TransactionMatch[] {
  const matches: TransactionMatch[] = [];
  
  // Simple matching logic - can be enhanced
  for (const bankTx of bankTransactions) {
    for (const xeroTx of xeroTransactions) {
      // Match by amount and date
      if (
        Math.abs(bankTx.amount - xeroTx.amount) < 0.01 &&
        new Date(bankTx.date).toDateString() === new Date(xeroTx.date).toDateString()
      ) {
        matches.push({
          bankTransactionId: bankTx.id,
          xeroTransactionId: xeroTx.id,
          confidence: 0.9,
          matchType: 'exact'
        });
        break;
      }
    }
  }
  
  return matches;
}