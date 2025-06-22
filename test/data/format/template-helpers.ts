#!/usr/bin/env node

// Helper functions for format template
// Provides string matching for template conditionals

export function match(str: string, pattern: string): boolean {
  if (typeof str !== 'string' || typeof pattern !== 'string') {
    return false;
  }
  return str.includes(pattern);
}