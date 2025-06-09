export interface Transaction {
  id: string;
  date: string;
  amount: number;
  description: string;
  type: 'SPEND' | 'RECEIVE';
  status: 'unreconciled' | 'reconciling' | 'reconciled';
  bankAccountId?: string;
  bankAccountName?: string;
  contact?: string;
  reference?: string;
  isReconciled: boolean;
  hasAttachments?: boolean;
  lineItems?: any[];
  
  // Matching info
  matchedRule?: {
    ruleId: string;
    ruleName: string;
    confidence: number;
    suggestedReference: string;
    suggestedDescription: string;
    accountCode: string;
    taxType: string;
  };
}

export interface TransactionFilter {
  status?: 'all' | 'matched' | 'unmatched';
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  bankAccount?: string;
}

export interface ReconcileData {
  transactionId: string;
  reference: string;
  description: string;
  accountCode: string;
  taxType: string;
  createRule?: boolean;
  rulePattern?: string;
  ruleName?: string;
}