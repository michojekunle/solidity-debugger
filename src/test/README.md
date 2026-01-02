# Integration Test Suite

## Overview
Comprehensive integration tests for the Solidity Debugger extension, covering all major features from contract analysis to UI updates.

## Test Files

### 1. `compiler.integration.test.ts`
Tests contract selection and compilation logic:
- ✅ Selects correct contract from file (not imports)
- ✅ Prefers concrete contracts over abstract ones
- ✅ Bytecode extraction with multiple fallback strategies
- ✅ Handles abstract contracts gracefully

### 2. `gasSourceMapper.integration.test.ts`
Tests bytecode-to-source mapping and gas analysis:
- ✅ Parses solc source maps correctly
- ✅ Detects gas usage patterns (repeated SLOAD, storage in loops)
- ✅ Categorizes by severity (optimal/warning/high/critical)
- ✅ Generates actionable recommendations
- ✅ Maps bytecode positions to source code ranges
- ✅ Decodes bytecode into opcodes

### 3. `gasTourProvider.integration.test.ts`
Tests interactive gas tour navigation:
- ✅ Starts tour and emits events
- ✅ Navigates through hotspots (next/previous)
- ✅ Sorts hotspots by severity
- ✅ Finishes tour and converts to diagnostics
- ✅ Handles empty hotspots gracefully
- ✅ Prevents navigation beyond bounds
- ✅ Emits step changed events

### 4. `contractSimulator.test.ts` (Existing)
Tests contract function simulation:
- ✅ Simulates ERC20 transfer correctly  
- ✅ Handles transferOwnership (not as ERC20 transfer)
- ✅ Runtime simulation via debug_traceCall
- ✅ Fallback to manual simulation
- ✅ Invalid function handling

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test Suite
```bash
npm test compiler.integration.test.ts
npm test gasSourceMapper.integration.test.ts
npm test gasTourProvider.integration.test.ts
```

### Run with Coverage
```bash
npm run test:coverage
```

### Watch Mode
```bash
npm run test:watch
```

## Test Structure

Each test file follows this pattern:
```typescript
describe('Component Name', () => {
  let instance: Component;

  beforeEach(() => {
    instance = new Component();
  });

  it('should do something specific', () => {
    // Arrange
    const input = setupInput();
    
    // Act
    const result = instance.method(input);
    
    // Assert
    expect(result).toBe(expected);
  });
});
```

## Mocking VS Code API

Tests that require VS Code API use vitest mocks:
```typescript
vi.mock('vscode', () => ({
  window: {
    showInformationMessage: vi.fn(),
    createTextEditorDecorationType: vi.fn(() => ({ dispose: vi.fn() })),
  },
  // ... other mocks
}));
```

## Test Coverage Goals

| Component | Target Coverage |
|-----------|----------------|
| Compiler | 90%+ |
| GasSourceMapper | 85%+ |
| GasTourProvider | 90%+ |
| ContractSimulator | 90%+ |
| StateCollector | 80%+ |
| Webview Panels | 75%+ |

## Known Limitations

1. **Solc Compilation**: Some tests may fail if OpenZeppelin contracts aren't available. This is expected and tests handle it gracefully.
2. **VS Code API**: Mocked in tests, so behavior may differ slightly from real extension runtime.
3. **Source Maps**: Accuracy depends on solc version and compiler settings.

## Adding New Tests

When adding a new feature:

1. **Create integration test file**: `src/test/yourFeature.integration.test.ts`
2. **Follow naming conventions**: `feature.integration.test.ts` for integration, `feature.test.ts` for unit
3. **Add to this README**: Document what the test covers
4. **Update coverage goals**: Set target coverage percentage

## Continuous Integration

Tests run automatically on:
- Every commit (pre-commit hook)
- Pull requests
- Main branch merges

## Troubleshooting

**Tests timing out?**
- Increase timeout in vitest.config.ts
- Check for infinite loops in code

**Mock issues?**
- Ensure vitest is using correct mock setup
- Check that `vi.mock()` is called before imports

**Compilation errors in tests?**
- Make sure test fixtures are valid Solidity
- Handle expected compilation failures gracefully

## Future Test Areas

- [ ] Webview UI component tests
- [ ] VS Code command integration tests  
- [ ] Multi-file contract compilation
- [ ] Gas optimization suggestion application
- [ ] State visualization timeline navigation
