# Testing Guide

## Overview

This project includes a comprehensive test suite covering unit tests, integration tests, and validation tests for the Solidity Debugger extension.

## Running Tests

### Run all tests
\`\`\`bash
npm test
\`\`\`

### Run tests in watch mode
\`\`\`bash
npm run test:watch
\`\`\`

### Run tests with UI
\`\`\`bash
npm run test:ui
\`\`\`

### Generate coverage report
\`\`\`bash
npm run test:coverage
\`\`\`

## Test Structure

### Unit Tests

- **errorHandler.test.ts** - Tests for error handling and logging
  - Error logging with context
  - Memory leak prevention
  - Error retrieval and clearing
  - Warning functionality

- **validation.test.ts** - Tests for input validation
  - Ethereum address validation
  - Transaction hash validation
  - Function input validation
  - Zero address checks

- **contractSimulator.test.ts** - Tests for contract simulation
  - ABI parsing
  - Function simulation (transfer, mint, burn, approve, setters)
  - State change tracking
  - Function history

- **gasEstimator.test.ts** - Tests for gas analysis
  - Trace data processing
  - Opcode counting
  - Gas usage analysis
  - Optimization recommendations

### Integration Tests

- **stateCollector.test.ts** - Tests for state collection
  - State collector initialization
  - Trace data processing
  - Event emission
  - State clearing

- **integration.test.ts** - Cross-system integration tests
  - Error handling with validation
  - Multi-step validation pipelines
  - Error recovery workflows

## Coverage Goals

- **Lines**: 70%
- **Functions**: 70%
- **Branches**: 65%
- **Statements**: 70%

## Test Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Clear Names**: Test names should clearly describe what is being tested
3. **Arrange-Act-Assert**: Follow the AAA pattern in test structure
4. **Mocking**: Use Vitest's mocking capabilities for external dependencies
5. **Error Cases**: Always test both success and failure scenarios

## Adding New Tests

When adding new features:

1. Write tests before implementation (TDD)
2. Ensure tests are in the appropriate test file
3. Follow existing test patterns
4. Run coverage report to ensure adequate coverage
5. Update this guide if adding new test categories

## Continuous Integration

Tests are run automatically on:
- Pull requests
- Commits to main branch
- Pre-publish verification

Ensure all tests pass before merging code.
