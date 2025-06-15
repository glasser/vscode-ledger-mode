#!/usr/bin/env node

// Script to validate that we maintain 100% test coverage
// This ensures that any new code without tests fails the build

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REQUIRED_STATEMENT_COVERAGE = 100;
const REQUIRED_BRANCH_COVERAGE = 100;
const REQUIRED_FUNCTION_COVERAGE = 100;
const REQUIRED_LINE_COVERAGE = 100;

function runCoverageCheck() {
    console.log('Running test coverage validation...');
    
    try {
        // Run tests with coverage
        const output = execSync('npm run test:coverage', { 
            encoding: 'utf8',
            cwd: path.join(__dirname, '..')
        });
        
        // Read coverage from the generated HTML file
        const coverageHtmlPath = path.join(__dirname, '..', 'coverage', 'index.html');
        if (!fs.existsSync(coverageHtmlPath)) {
            console.error('❌ Coverage report not found at:', coverageHtmlPath);
            process.exit(1);
        }
        
        const htmlContent = fs.readFileSync(coverageHtmlPath, 'utf8');
        
        // Parse coverage percentages from HTML
        const statementsMatch = htmlContent.match(/<span class="strong">([\d.]+)%\s*<\/span>\s*<span class="quiet">Statements<\/span>/);
        const branchesMatch = htmlContent.match(/<span class="strong">([\d.]+)%\s*<\/span>\s*<span class="quiet">Branches<\/span>/);
        const functionsMatch = htmlContent.match(/<span class="strong">([\d.]+)%\s*<\/span>\s*<span class="quiet">Functions<\/span>/);
        const linesMatch = htmlContent.match(/<span class="strong">([\d.]+)%\s*<\/span>\s*<span class="quiet">Lines<\/span>/);
        
        if (!statementsMatch || !branchesMatch || !functionsMatch || !linesMatch) {
            console.error('❌ Could not parse coverage percentages from HTML report');
            process.exit(1);
        }
        
        const statementPct = parseFloat(statementsMatch[1]);
        const branchPct = parseFloat(branchesMatch[1]);
        const functionPct = parseFloat(functionsMatch[1]);
        const linePct = parseFloat(linesMatch[1]);
        
        console.log(`📊 Coverage Summary:`);
        console.log(`   Statements: ${statementPct}%`);
        console.log(`   Branches:   ${branchPct}%`);
        console.log(`   Functions:  ${functionPct}%`);
        console.log(`   Lines:      ${linePct}%`);
        
        // Check if coverage meets requirements
        const failures = [];
        
        if (statementPct < REQUIRED_STATEMENT_COVERAGE) {
            failures.push(`Statements: ${statementPct}% < ${REQUIRED_STATEMENT_COVERAGE}%`);
        }
        
        if (branchPct < REQUIRED_BRANCH_COVERAGE) {
            failures.push(`Branches: ${branchPct}% < ${REQUIRED_BRANCH_COVERAGE}%`);
        }
        
        if (functionPct < REQUIRED_FUNCTION_COVERAGE) {
            failures.push(`Functions: ${functionPct}% < ${REQUIRED_FUNCTION_COVERAGE}%`);
        }
        
        if (linePct < REQUIRED_LINE_COVERAGE) {
            failures.push(`Lines: ${linePct}% < ${REQUIRED_LINE_COVERAGE}%`);
        }
        
        if (failures.length > 0) {
            console.error('❌ Coverage validation failed:');
            failures.forEach(failure => console.error(`   ${failure}`));
            console.error('\n💡 Add tests or mark uncovered code with /* istanbul ignore next */ comments');
            process.exit(1);
        }
        
        console.log('✅ Coverage validation passed - 100% coverage maintained!');
        
    } catch (error) {
        console.error('❌ Coverage validation failed:', error.message);
        process.exit(1);
    }
}

// Check if coverage directory exists first
const coverageDir = path.join(__dirname, '..', 'coverage');
if (!fs.existsSync(coverageDir)) {
    console.log('📋 Coverage directory not found, generating coverage report...');
}

runCoverageCheck();