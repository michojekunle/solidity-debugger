# Dependency Checking Feature

## Overview
The Solidity Debugger now automatically detects missing package dependencies and provides helpful installation instructions tailored to your project type (npm/Hardhat or Foundry).

## How It Works

### Automatic Detection
When you try to analyze a contract that imports external packages:

```solidity
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract MyToken is ERC20 {
    // ...
}
```

The extension will:
1. **Extract imports**: Parse all import statements
2. **Identify external packages**: Filter out relative imports (./local files)
3. **Detect project type**: Check for `foundry.toml`, `package.json`, or `hardhat.config`
4. **Check installation**: Verify packages exist in `node_modules/` or `lib/`
5. **Show helpful error**: If packages are missing, display tailored instructions

### Error Messages

#### For npm/Hardhat Projects
```
Missing dependencies detected:
  • @openzeppelin/contracts
  • @chainlink/contracts

To install, run:
npm install @openzeppelin/contracts @chainlink/contracts
```

#### For Foundry Projects
```
Missing dependencies detected:
  • @openzeppelin/contracts

To install, run:
forge install OpenZeppelin/openzeppelin-contracts
```

### Interactive UI
When missing dependencies are detected, you'll see:
- ❌ Error notification: "Missing X package(s). Click 'Install' to copy the command."
- 📋 **Install button**: Copies the install command to your clipboard
- 💡 **Dismiss button**: Close the notification

## Supported Package Managers

### npm/Hardhat
- **Detection**: Looks for `package.json` or `hardhat.config.js/ts`
- **Check**: Verifies packages in `node_modules/`
- **Command**: Generates `npm install <packages>`

### Foundry
- **Detection**: Looks for `foundry.toml`
- **Check**: Verifies packages in `lib/` directory
- **Command**: Generates `forge install <repo>` (with proper repo mapping)

**Package Mapping for Foundry**:
- `@openzeppelin/contracts` → `OpenZeppelin/openzeppelin-contracts`
- Custom packages use their npm name as-is

## Examples

### Example 1: Missing OpenZeppelin in npm Project

**Contract**:
```solidity
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
```

**Error Before**:
```
Compilation failed: File import callback not supported
```

**Error After**:
```
Missing dependencies: @openzeppelin/contracts
Run: npm install @openzeppelin/contracts

[Install] [Dismiss]
```

Clicking **Install** copies: `npm install @openzeppelin/contracts`

### Example 2: Multiple Missing Packages

**Contract**:
```solidity
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "hardhat/console.sol";
```

**Suggested Command**:
```bash
npm install @openzeppelin/contracts @chainlink/contracts hardhat
```

### Example 3: Foundry Project

**Contract**:
```solidity
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
```

**Suggested Command**:
```bash
forge install OpenZeppelin/openzeppelin-contracts
```

## Technical Details

### Import Detection
Uses regex to extract all imports:
```typescript
const importRegex = /import\s+["']([^"']+)["'];/g;
```

### External Package Detection
Identifies non-relative imports:
- ✅ External: `@openzeppelin/contracts/...`
- ✅ External: `hardhat/console.sol`
- ❌ Relative: `./MyContract.sol`
- ❌ Relative: `../base/Base.sol`

### Package Name Extraction
Extracts root package from import path:
- `@openzeppelin/contracts/token/ERC20/ERC20.sol` → `@openzeppelin/contracts`
- `hardhat/console.sol` → `hardhat`

### Project Type Detection
Checks for configuration files in order:
1. `foundry.toml` → Foundry
2. `package.json` or `hardhat.config.*` → npm/Hardhat
3. None found → Unknown (suggest both commands)

### Installation Check

**npm Projects**:
```typescript
const installed = fs.existsSync(
  path.join(workspaceRoot, 'node_modules', '@openzeppelin', 'contracts')
);
```

**Foundry Projects**:
```typescript
const installed = fs.existsSync(
  path.join(workspaceRoot, 'lib', 'openzeppelin-contracts')
);
```

## Configuration

No configuration needed! The feature works automatically.

## Limitations

1. **Custom remappings**: Foundry projects with custom remappings may need manual adjustment
2. **Private packages**: Cannot detect if private npm packages are accessible
3. **Network issues**: Doesn't check if packages are available online
4. **Version conflicts**: Doesn't validate package version compatibility

## Troubleshooting

### Issue: False positive (package is installed)
**Cause**: Package installed in non-standard location
**Solution**: 
- For npm: Ensure package is in `node_modules/`
- For Foundry: Ensure package is in `lib/`
- Check for custom remappings

### Issue: Wrong project type detected
**Cause**: Multiple config files present (e.g., both `package.json` and `foundry.toml`)
**Solution**: The extension prioritizes Foundry. If you're using Hardhat, ensure `foundry.toml` is not in your root directory.

### Issue: Wrong forge install command
**Cause**: Package name mapping not configured
**Solution**: Currently only `@openzeppelin/contracts` is auto-mapped. For other packages, copy the command and adjust the repo name manually.

## Future Enhancements

- [ ] Auto-installation with user confirmation
- [ ] Support for more package mappings (Foundry)
- [ ] Custom remapping detection
- [ ] Version suggestion based on pragma
- [ ] Integration with package.json scripts

## API Reference

### DependencyChecker Class

#### Methods

**`extractImports(sourceCode: string): string[]`**
- Extracts import statements from Solidity code
- Returns array of import paths

**`isExternalPackage(importPath: string): boolean`**
- Checks if import is external package (not relative path)

**`getPackageName(importPath: string): string`**
- Extracts package name from import path
- Handles scoped (@scope/package) and regular packages

**`detectProjectType(workspaceRoot: string): 'npm' | 'foundry' | 'unknown'`**
- Detects project type from configuration files

**`checkDependencies(sourceCode: string, filePath: string): DependencyCheckResult`**
- Main method: checks all dependencies
- Returns missing packages and install command

**`showDependencyError(result: DependencyCheckResult): void`**
- Shows VS Code error notification with install instructions

**`isMissingImportError(error: string): boolean`**
- Checks if compilation error is due to missing imports

#### Types

```typescript
interface DependencyCheckResult {
  missing: string[];           // Array of missing package names
  projectType: 'npm' | 'foundry' | 'unknown';
  installCommand: string;      // Generated install command
}
```
