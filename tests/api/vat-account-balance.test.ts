import { describe, it, expect } from 'vitest';

describe('VAT Account Balance Logic', () => {
  it('should calculate YTD amount from debit when net is zero', () => {
    // Simulate the VAT account data from Xero
    const vatAccount = {
      accountName: 'VAT (820)',
      ytdDebit: 87.29,
      ytdCredit: 0,
      netAmount: 0
    };
    
    // Apply the same logic as in trial-balance-all route
    let ytdAmount = 0;
    if (vatAccount.netAmount !== 0) {
      ytdAmount = vatAccount.netAmount;
    } else if (vatAccount.ytdDebit !== 0) {
      ytdAmount = vatAccount.ytdDebit;
    } else if (vatAccount.ytdCredit !== 0) {
      ytdAmount = -vatAccount.ytdCredit;
    }
    
    // VAT account should show 87.29 as YTD amount
    expect(ytdAmount).toBe(87.29);
    expect(ytdAmount).not.toBe(0);
  });

  it('should calculate YTD amount from credit as negative when debit is zero', () => {
    const account = {
      accountName: 'Sales (400)',
      ytdDebit: 0,
      ytdCredit: 1000,
      netAmount: 0
    };
    
    let ytdAmount = 0;
    if (account.netAmount !== 0) {
      ytdAmount = account.netAmount;
    } else if (account.ytdDebit !== 0) {
      ytdAmount = account.ytdDebit;
    } else if (account.ytdCredit !== 0) {
      ytdAmount = -account.ytdCredit;
    }
    
    // Credit balance should be negative
    expect(ytdAmount).toBe(-1000);
  });

  it('should use net amount when provided', () => {
    const account = {
      accountName: 'Overseas VAT (459)',
      ytdDebit: 0,
      ytdCredit: 0,
      netAmount: 4.38
    };
    
    let ytdAmount = 0;
    if (account.netAmount !== 0) {
      ytdAmount = account.netAmount;
    } else if (account.ytdDebit !== 0) {
      ytdAmount = account.ytdDebit;
    } else if (account.ytdCredit !== 0) {
      ytdAmount = -account.ytdCredit;
    }
    
    // Should use the net amount
    expect(ytdAmount).toBe(4.38);
  });

  it('should show zero only when all amounts are zero', () => {
    const account = {
      accountName: 'Unused Account',
      ytdDebit: 0,
      ytdCredit: 0,
      netAmount: 0
    };
    
    let ytdAmount = 0;
    if (account.netAmount !== 0) {
      ytdAmount = account.netAmount;
    } else if (account.ytdDebit !== 0) {
      ytdAmount = account.ytdDebit;
    } else if (account.ytdCredit !== 0) {
      ytdAmount = -account.ytdCredit;
    }
    
    expect(ytdAmount).toBe(0);
  });
});