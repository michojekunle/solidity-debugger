# Contributing to Solidity Debugger

Thank you for your interest in contributing to the Solidity Debugger extension! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
- [Coding Guidelines](#coding-guidelines)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)

---

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

### Our Standards

- **Be Respectful**: Treat everyone with respect and kindness
- **Be Inclusive**: Welcome newcomers and diverse perspectives
- **Be Professional**: Keep discussions focused and constructive
- **Be Patient**: Remember that everyone has different skill levels

---

## Getting Started

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v8.0.0 or higher
- **VS Code**: v1.96.0 or higher
- **Git**: For version control

### Setting Up Development Environment

1. **Fork the repository**
   ```bash
   # Click the "Fork" button on GitHub
   ```

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/solidity-debugger.git
   cd solidity-debugger
   ```

3. **Add upstream remote**
   ```bash
   git remote add upstream https://github.com/michojekunle/solidity-debugger.git
   ```

4. **Install dependencies**
   ```bash
   npm run install:all
   ```

5. **Compile the extension**
   ```bash
   npm run compile
   ```

6. **Run in development mode**
   - Press `F5` in VS Code to open Extension Development Host

---

## Development Workflow

### 1. Create a Branch

Always create a new branch for your work:

```bash
# Update your main branch
git checkout main
git pull upstream main

# Create a feature branch
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

**Branch naming conventions:**
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions or changes
- `chore/` - Build, configuration, or tooling changes

### 2. Make Your Changes

- Write clean, readable code
- Follow the existing code style
- Add tests for new features
- Update documentation as needed

### 3. Test Your Changes

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run linter
npm run lint

# Compile TypeScript
npm run compile

# Build webview
npm run build:webview
```

### 4. Commit Your Changes

We use conventional commits for clear commit history:

```bash
git add .
git commit -m "type(scope): description"
```

**Commit types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Test changes
- `chore`: Build, configuration, or tooling changes
- `perf`: Performance improvements

**Examples:**
```bash
git commit -m "feat(gas-analyzer): add optimization suggestions"
git commit -m "fix(state-visualizer): resolve race condition in state updates"
git commit -m "docs(readme): update installation instructions"
git commit -m "test(contract-simulator): add tests for burn function"
```

### 5. Push to Your Fork

```bash
git push origin feature/your-feature-name
```

---

## Pull Request Process

### Before Submitting

- [ ] All tests pass (`npm test`)
- [ ] Code compiles without errors (`npm run compile`)
- [ ] Linter passes (`npm run lint`)
- [ ] Documentation is updated
- [ ] CHANGELOG.md is updated (for significant changes)
- [ ] Commits follow conventional commit format

### Submitting a Pull Request

1. **Go to your fork on GitHub**
2. **Click "New Pull Request"**
3. **Select base repository**: `michojekunle/solidity-debugger`
4. **Select base branch**: `main`
5. **Select compare branch**: `feature/your-feature-name`
6. **Fill out the PR template**:

```markdown
## Description
Brief description of what this PR does

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
Describe how you tested your changes

## Checklist
- [ ] Tests pass
- [ ] Code compiles
- [ ] Linter passes
- [ ] Documentation updated
- [ ] CHANGELOG updated (if applicable)

## Related Issues
Closes #123
```

7. **Click "Create Pull Request"**

### Review Process

- Maintainers will review your PR
- Address any requested changes
- Once approved, your PR will be merged

### Updating Your PR

If changes are requested:

```bash
# Make your changes
git add .
git commit -m "fix: address review feedback"
git push origin feature/your-feature-name
```

---

## Coding Guidelines

### TypeScript

- Use TypeScript for all new code
- Avoid `any` type - use specific types or generics
- Use interfaces for object shapes
- Use enums for constants with multiple values
- Document complex types and interfaces

**Example:**
```typescript
interface StateChange {
  variable: string;
  oldValue: string | number;
  newValue: string | number;
  timestamp: number;
}

function trackStateChange(change: StateChange): void {
  // Implementation
}
```

### Code Style

- **Indentation**: 2 spaces
- **Quotes**: Single quotes for strings
- **Semicolons**: Always use semicolons
- **Line length**: Max 100 characters
- **Naming**:
  - `camelCase` for variables and functions
  - `PascalCase` for classes and interfaces
  - `UPPER_SNAKE_CASE` for constants
  - Descriptive names over short names

### React/UI Code

- Use functional components with hooks
- Use TypeScript for props
- Keep components small and focused
- Extract reusable logic into custom hooks

**Example:**
```typescript
interface StateVisualizerProps {
  states: StateChange[];
  currentIndex: number;
  onNext: () => void;
}

export const StateVisualizer: React.FC<StateVisualizerProps> = ({
  states,
  currentIndex,
  onNext
}) => {
  // Component implementation
};
```

### Error Handling

- Always handle errors gracefully
- Use try-catch for async operations
- Log errors with context
- Provide user-friendly error messages

**Example:**
```typescript
try {
  const result = await analyzeContract(contractPath);
  return result;
} catch (error) {
  logError('Failed to analyze contract', { contractPath, error });
  vscode.window.showErrorMessage(
    'Failed to analyze contract. Please check the console for details.'
  );
  throw error;
}
```

---

## Testing Guidelines

### Test Structure

- Use Vitest for testing
- Follow Arrange-Act-Assert pattern
- Keep tests isolated and independent
- Use descriptive test names

**Example:**
```typescript
describe('ContractSimulator', () => {
  describe('simulateTransfer', () => {
    it('should update balances correctly for valid transfer', () => {
      // Arrange
      const simulator = new ContractSimulator();
      const from = '0x123...';
      const to = '0x456...';
      const amount = 100;
      
      // Act
      const result = simulator.simulateTransfer(from, to, amount);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.balances[from]).toBe(900);
      expect(result.balances[to]).toBe(100);
    });
  });
});
```

### Test Coverage

Maintain these coverage goals:
- **Lines**: 70%
- **Functions**: 70%
- **Branches**: 65%
- **Statements**: 70%

### What to Test

- **Unit Tests**: Individual functions and modules
- **Integration Tests**: Cross-module interactions
- **Edge Cases**: Boundary conditions, null/undefined, empty inputs
- **Error Cases**: Expected failures and error handling

---

## Documentation

### Code Documentation

Use JSDoc for functions and classes:

```typescript
/**
 * Analyzes gas usage for a Solidity contract
 * @param contractPath - Path to the Solidity contract file
 * @param traceData - Transaction trace data
 * @returns Gas analysis results with optimization suggestions
 * @throws Error if contract compilation fails
 */
export async function analyzeGasUsage(
  contractPath: string,
  traceData: TraceData
): Promise<GasAnalysisResult> {
  // Implementation
}
```

### README Updates

When adding features:
- Update the Features section
- Add usage examples
- Update command list
- Add screenshots/GIFs if applicable

### CHANGELOG Updates

For significant changes, update CHANGELOG.md:

```markdown
## [Unreleased]

### Added
- New feature description

### Changed
- What was changed

### Fixed
- What was fixed
```

---

## Project Structure

```
solidity-debugger/
├── src/                    # Extension source code
│   ├── core/              # Core functionality
│   │   ├── debugAdapter/  # Debug adapter implementation
│   │   ├── analysis/      # State and gas analysis
│   │   └── compiler/      # Solidity compilation
│   ├── webviews/          # Webview panels
│   ├── utils/             # Utility functions
│   ├── test/              # Test files
│   └── extension.ts       # Extension entry point
├── webview-ui/            # React-based webview UI
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── hooks/         # Custom hooks
│   │   └── App.tsx        # Main app component
│   └── package.json
├── out/                   # Compiled extension code
├── .github/               # GitHub workflows
├── docs/                  # Documentation
└── package.json           # Extension manifest
```

---

## Common Tasks

### Adding a New Command

1. **Define command in `package.json`**:
```json
{
  "command": "solidityDebugger.myNewCommand",
  "title": "Solidity Debugger: My New Command"
}
```

2. **Register command in `extension.ts`**:
```typescript
const disposable = vscode.commands.registerCommand(
  'solidityDebugger.myNewCommand',
  async () => {
    // Command implementation
  }
);
context.subscriptions.push(disposable);
```

3. **Add tests**:
```typescript
describe('myNewCommand', () => {
  it('should execute successfully', async () => {
    // Test implementation
  });
});
```

4. **Update documentation**

### Adding a New Webview Panel

1. Create component in `webview-ui/src/components/`
2. Create panel in `src/webviews/panels/`
3. Register panel in `extension.ts`
4. Add styling
5. Add tests
6. Update documentation

---

## Getting Help

- **Questions**: Open a [GitHub Discussion](https://github.com/michojekunle/solidity-debugger/discussions)
- **Bugs**: Report via [GitHub Issues](https://github.com/michojekunle/solidity-debugger/issues)
- **Feature Requests**: Open a [GitHub Issue](https://github.com/michojekunle/solidity-debugger/issues) with the "enhancement" label

---

## Recognition

Contributors will be recognized in:
- The README (Contributors section)
- Release notes (for significant contributions)
- GitHub contributors page

---

Thank you for contributing to Solidity Debugger! 🚀
