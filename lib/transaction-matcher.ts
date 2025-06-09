import { prisma } from './prisma';
import { Transaction } from './types/transactions';

export async function matchTransactionWithRules(transaction: Transaction): Promise<Transaction> {
  try {
    // Get all active rules ordered by priority
    const rules = await prisma.categorizationRule.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' }
    });
    
    // Try to match transaction against each rule
    for (const rule of rules) {
      const fieldValue = getFieldValue(transaction, rule.matchField);
      
      if (!fieldValue) continue;
      
      const isMatch = checkMatch(fieldValue, rule.matchValue, rule.matchType);
      
      if (isMatch) {
        // Found a match!
        return {
          ...transaction,
          matchedRule: {
            ruleId: rule.id,
            ruleName: rule.name,
            confidence: calculateConfidence(fieldValue, rule.matchValue, rule.matchType),
            suggestedReference: generateReference(transaction, rule),
            suggestedDescription: rule.description || transaction.description,
            accountCode: rule.accountCode,
            taxType: rule.taxType
          }
        };
      }
    }
    
    // No match found
    return transaction;
  } catch (error) {
    console.error('Error matching transaction:', error);
    return transaction;
  }
}

function getFieldValue(transaction: Transaction, field: string): string {
  switch (field) {
    case 'description':
      return transaction.description;
    case 'reference':
      return transaction.reference || '';
    case 'payee':
      return transaction.contact || '';
    default:
      return '';
  }
}

function checkMatch(value: string, pattern: string, matchType: string): boolean {
  const normalizedValue = value.toLowerCase();
  const normalizedPattern = pattern.toLowerCase();
  
  switch (matchType) {
    case 'equals':
      return normalizedValue === normalizedPattern;
    case 'contains':
      return normalizedValue.includes(normalizedPattern);
    case 'startsWith':
      return normalizedValue.startsWith(normalizedPattern);
    case 'endsWith':
      return normalizedValue.endsWith(normalizedPattern);
    default:
      return false;
  }
}

function calculateConfidence(value: string, pattern: string, matchType: string): number {
  if (matchType === 'equals' && value.toLowerCase() === pattern.toLowerCase()) {
    return 100;
  }
  
  if (matchType === 'contains') {
    // Higher confidence if the pattern is a larger portion of the value
    const ratio = pattern.length / value.length;
    return Math.min(95, Math.round(ratio * 100));
  }
  
  if (matchType === 'startsWith' || matchType === 'endsWith') {
    return 90;
  }
  
  return 80;
}

function generateReference(transaction: Transaction, rule: any): string {
  // Generate a reference based on the rule and transaction
  const date = new Date(transaction.date);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  
  // If rule has a specific reference pattern, use it
  if (rule.reference) {
    return rule.reference
      .replace('{MONTH}', month)
      .replace('{YEAR}', year.toString())
      .replace('{AMOUNT}', Math.abs(transaction.amount).toFixed(2));
  }
  
  // Default reference pattern
  return `${rule.name.toUpperCase().replace(/\s+/g, '-')}-${month}${year}`;
}

export async function matchTransactions(transactions: Transaction[]): Promise<Transaction[]> {
  const matchedTransactions = await Promise.all(
    transactions.map(tx => matchTransactionWithRules(tx))
  );
  
  return matchedTransactions;
}