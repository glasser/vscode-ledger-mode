#!/usr/bin/env node

// Helper functions for tokenization template
// Processes JSON test files for parsing functionality


export function formatJson(obj: any): string {
  return JSON.stringify(obj, null, 2);
}

export function isJsonFile(name: string): boolean {
  // Template-generator loads JSON files without the .json extension
  // Check if this is one of the known JSON test files
  const jsonFiles = [
    'invalid-parsing-examples',
    'posting-parsing-examples', 
    'reconciliation-parsing-examples',
    'transaction-parsing-examples'
  ];
  return jsonFiles.includes(name);
}

export function getSectionTitle(name: string): string {
  return name.replace(/-/g, ' ').replace(/\.json$/, '');
}

export function isParsingTest(name: string): boolean {
  return name.includes('parsing-examples');
}

export function isInvalidTest(name: string): boolean {
  return name.includes('invalid');
}

export function getJsonContent(testCase: any): any {
  // The template-generator loads JSON files and spreads their content onto the testCase
  // When a JSON file contains an array, it gets spread as properties 0, 1, 2, etc.
  
  // First check for numeric properties (spread array)
  const numericKeys = Object.keys(testCase).filter(key => /^\d+$/.test(key)).sort((a, b) => parseInt(a) - parseInt(b));
  if (numericKeys.length > 0) {
    return numericKeys.map(key => testCase[key]);
  }
  
  // Look for array properties that are not name/title
  for (const key in testCase) {
    if (key !== 'name' && key !== 'title' && Array.isArray(testCase[key])) {
      return testCase[key];
    }
  }
  
  // If no array found, try the testCase itself if it's an array
  if (Array.isArray(testCase)) {
    return testCase;
  }
  
  return [];
}

export function getTotalTestCases(testCases: any[]): number {
  let total = 0;
  for (const testCase of testCases) {
    if (isJsonFile(testCase.name)) {
      const content = getJsonContent(testCase);
      if (Array.isArray(content)) {
        total += content.length;
      }
    }
  }
  return total;
}