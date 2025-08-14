// Cache for parsed transactions to avoid re-parsing on every keystroke
// Significantly improves performance with large ledger files

import * as vscode from "vscode";
import { LRUCache } from "lru-cache";
import { ParsedTransaction } from "./transactionCompletion";
import { TransactionParser } from "./transactionCompletion";

interface CacheEntry {
  transactions: ParsedTransaction[];
  payees: Map<string, number>;
  accounts: Map<string, number>;
}

export class CompletionCache {
  // LRU cache with max 10 entries and 10-second TTL
  private static cache = new LRUCache<string, CacheEntry>({
    max: 10, // Max 10 documents cached
    ttl: 10000, // 10 seconds time-to-live
  });
  
  static getTransactions(document: vscode.TextDocument): ParsedTransaction[] {
    const uri = document.uri.toString();
    
    // Check if we have a recent cache entry (within 10 seconds)
    const cached = this.cache.get(uri);
    if (cached) {
      return cached.transactions;
    }
    
    // Parse and cache
    const transactions = TransactionParser.getAllTransactions(document);
    this.updateCache(uri, transactions);
    return transactions;
  }
  
  static getPayees(document: vscode.TextDocument): Map<string, number> {
    const uri = document.uri.toString();
    
    // Check if we have a recent cache entry (within 10 seconds)
    const cached = this.cache.get(uri);
    if (cached && cached.payees) {
      return cached.payees;
    }
    
    // Parse and extract payees
    const transactions = this.getTransactions(document);
    const payees = new Map<string, number>();
    
    for (const transaction of transactions) {
      if (transaction.payee) {
        const count = payees.get(transaction.payee) || 0;
        payees.set(transaction.payee, count + 1);
      }
    }
    
    // Update cache with payees
    const entry = this.cache.get(uri);
    if (entry) {
      entry.payees = payees;
      // Re-set to refresh TTL
      this.cache.set(uri, entry);
    }
    
    return payees;
  }
  
  static getAccounts(document: vscode.TextDocument): Map<string, number> {
    const uri = document.uri.toString();
    
    // Check if we have a recent cache entry (within 10 seconds)
    const cached = this.cache.get(uri);
    if (cached && cached.accounts) {
      return cached.accounts;
    }
    
    // Parse and extract accounts
    const transactions = this.getTransactions(document);
    const accounts = new Map<string, number>();
    
    for (const transaction of transactions) {
      for (const posting of transaction.postings) {
        if (posting.account) {
          const count = accounts.get(posting.account) || 0;
          accounts.set(posting.account, count + 1);
        }
      }
    }
    
    // Update cache with accounts
    const entry = this.cache.get(uri);
    if (entry) {
      entry.accounts = accounts;
      // Re-set to refresh TTL
      this.cache.set(uri, entry);
    }
    
    return accounts;
  }
  
  private static updateCache(
    uri: string,
    transactions: ParsedTransaction[]
  ): void {
    // Extract payees and accounts while we have the transactions
    const payees = new Map<string, number>();
    const accounts = new Map<string, number>();
    
    for (const transaction of transactions) {
      if (transaction.payee) {
        const count = payees.get(transaction.payee) || 0;
        payees.set(transaction.payee, count + 1);
      }
      
      for (const posting of transaction.postings) {
        if (posting.account) {
          const count = accounts.get(posting.account) || 0;
          accounts.set(posting.account, count + 1);
        }
      }
    }
    
    // LRU cache handles TTL and size limits automatically
    this.cache.set(uri, {
      transactions,
      payees,
      accounts,
    });
  }
  
  // Clear cache for a specific document (useful for testing)
  static clearDocument(document: vscode.TextDocument): void {
    this.cache.delete(document.uri.toString());
  }
  
  // Clear all cache (useful for testing)
  static clearAll(): void {
    this.cache.clear();
  }
  
  // Get cache stats (useful for debugging)
  static getCacheStats(): { size: number; calculatedSize: number } {
    return {
      size: this.cache.size,
      calculatedSize: this.cache.calculatedSize,
    };
  }
}