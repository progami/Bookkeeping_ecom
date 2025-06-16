/**
 * Type definitions for Xero report structures
 */

export interface XeroReportCell {
  value?: string | number;
  attributes?: Array<{
    id: string;
    value: string;
  }>;
}

export interface XeroReportRow {
  rowType: 'Section' | 'Row' | 'Header';
  title?: string;
  cells?: XeroReportCell[];
  rows?: XeroReportRow[];
}

export interface XeroReport {
  reportID?: string;
  reportName?: string;
  reportType?: string;
  reportTitles?: string[];
  reportDate?: string;
  rows: XeroReportRow[];
}

export interface XeroReportResponse {
  reports: XeroReport[];
}

export interface XeroAccount {
  accountID?: string;
  code?: string;
  name?: string;
  type?: string;
  status?: string;
  description?: string;
  taxType?: string;
  enablePaymentsToAccount?: boolean;
  showInExpenseClaims?: boolean;
  class?: string;
  systemAccount?: string;
  reportingCode?: string;
  reportingCodeName?: string;
  hasAttachments?: boolean;
  updatedDateUTC?: string;
  addToWatchlist?: boolean;
}

export interface XeroBankTransaction {
  type: 'RECEIVE' | 'SPEND';
  contact?: {
    contactID?: string;
    name?: string;
  };
  lineItems?: Array<{
    description?: string;
    quantity?: number;
    unitAmount?: number;
    accountCode?: string;
    taxType?: string;
    taxAmount?: number;
    lineAmount?: number;
    tracking?: any[];
  }>;
  bankAccount?: {
    accountID?: string;
    code?: string;
    name?: string;
  };
  isReconciled?: boolean;
  date?: string;
  reference?: string;
  currencyCode?: string;
  currencyRate?: number;
  url?: string;
  status?: string;
  lineAmountTypes?: string;
  subTotal?: number;
  totalTax?: number;
  total?: number;
  bankTransactionID?: string;
  prepaymentID?: string;
  overpaymentID?: string;
  updatedDateUTC?: string;
  hasAttachments?: boolean;
}

export interface XeroInvoice {
  type: 'ACCREC' | 'ACCPAY';
  invoiceID?: string;
  invoiceNumber?: string;
  reference?: string;
  amountDue?: number;
  amountPaid?: number;
  amountCredited?: number;
  currencyRate?: number;
  isDiscounted?: boolean;
  hasAttachments?: boolean;
  hasErrors?: boolean;
  contact?: {
    contactID?: string;
    name?: string;
  };
  date?: string;
  dueDate?: string;
  status?: string;
  lineAmountTypes?: string;
  lineItems?: Array<{
    lineItemID?: string;
    description?: string;
    quantity?: number;
    unitAmount?: number;
    itemCode?: string;
    accountCode?: string;
    taxType?: string;
    taxAmount?: number;
    lineAmount?: number;
    tracking?: any[];
    discountRate?: number;
    discountAmount?: number;
    repeatingInvoiceID?: string;
  }>;
  subTotal?: number;
  totalTax?: number;
  total?: number;
  totalDiscount?: number;
  updatedDateUTC?: string;
  currencyCode?: string;
}

export interface XeroContact {
  contactID?: string;
  contactStatus?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  emailAddress?: string;
  skypeUserName?: string;
  contactPersons?: any[];
  bankAccountDetails?: string;
  taxNumber?: string;
  accountsReceivableTaxType?: string;
  accountsPayableTaxType?: string;
  addresses?: any[];
  phones?: any[];
  isSupplier?: boolean;
  isCustomer?: boolean;
  defaultCurrency?: string;
  updatedDateUTC?: string;
  contactGroups?: any[];
  xeroNetworkKey?: string;
  salesDefaultAccountCode?: string;
  purchasesDefaultAccountCode?: string;
  salesTrackingCategories?: any[];
  purchasesTrackingCategories?: any[];
  trackingCategoryName?: string;
  trackingCategoryOption?: string;
  paymentTerms?: any;
  website?: string;
  brandingTheme?: any;
  batchPayments?: any;
  discount?: number;
  balances?: any;
  attachments?: any[];
  hasAttachments?: boolean;
  validationErrors?: any[];
  hasValidationErrors?: boolean;
}