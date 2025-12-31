import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface DependencyCheckResult {
  missing: string[];
  projectType: 'npm' | 'foundry' | 'unknown';
  installCommand: string;
}

export class DependencyChecker {
  /**
   * Extract import statements from Solidity source code
   */
  public static extractImports(sourceCode: string): string[] {
    const importRegex = /import\s+["']([^"']+)["'];/g;
    const imports: string[] = [];
    let match;
    
    while ((match = importRegex.exec(sourceCode)) !== null) {
      imports.push(match[1]);
    }
    
    return imports;
  }

  /**
   * Detect if an import is an external package (not relative path)
   */
  public static isExternalPackage(importPath: string): boolean {
    // External packages don't start with . or /
    return !importPath.startsWith('.') && !importPath.startsWith('/');
  }

  /**
   * Extract package name from import path
   * e.g., "@openzeppelin/contracts/token/ERC20/ERC20.sol" -> "@openzeppelin/contracts"
   */
  public static getPackageName(importPath: string): string {
    if (importPath.startsWith('@')) {
      // Scoped package: @scope/package
      const parts = importPath.split('/');
      return `${parts[0]}/${parts[1]}`;
    } else {
      // Regular package: package-name
      return importPath.split('/')[0];
    }
  }

  /**
   * Detect project type based on config files
   */
  public static detectProjectType(workspaceRoot: string): 'npm' | 'foundry' | 'unknown' {
    const foundryConfig = path.join(workspaceRoot, 'foundry.toml');
    const packageJson = path.join(workspaceRoot, 'package.json');
    const hardhatConfig = path.join(workspaceRoot, 'hardhat.config.js');
    const hardhatConfigTs = path.join(workspaceRoot, 'hardhat.config.ts');

    // Check for Foundry
    if (fs.existsSync(foundryConfig)) {
      return 'foundry';
    }

    // Check for npm/Hardhat
    if (fs.existsSync(packageJson) || fs.existsSync(hardhatConfig) || fs.existsSync(hardhatConfigTs)) {
      return 'npm';
    }

    return 'unknown';
  }

  /**
   * Check if a package is installed in npm project
   */
  private static isNpmPackageInstalled(packageName: string, workspaceRoot: string): boolean {
    const nodeModulesPath = path.join(workspaceRoot, 'node_modules', ...packageName.split('/'));
    return fs.existsSync(nodeModulesPath);
  }

  /**
   * Check if a package is installed in Foundry project
   */
  private static isFoundryPackageInstalled(packageName: string, workspaceRoot: string): boolean {
    // Foundry uses lib/ directory
    const libPath = path.join(workspaceRoot, 'lib');
    
    if (!fs.existsSync(libPath)) {
      return false;
    }

    // Check if package exists in lib/
    // For scoped packages like @openzeppelin/contracts, check for various naming conventions
    const possibleNames = [
      packageName.replace('@', '').replace('/', '-'), // @openzeppelin/contracts -> openzeppelin-contracts
      packageName.split('/').pop() || '', // @openzeppelin/contracts -> contracts
      packageName, // exact name
    ];

    return possibleNames.some(name => {
      const pkgPath = path.join(libPath, name);
      return fs.existsSync(pkgPath);
    });
  }

  /**
   * Check dependencies and return missing packages with installation instructions
   */
  public static checkDependencies(sourceCode: string, filePath: string): DependencyCheckResult {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
    const workspaceRoot = workspaceFolder?.uri.fsPath || path.dirname(filePath);

    // Extract imports
    const imports = this.extractImports(sourceCode);
    const externalImports = imports.filter(imp => this.isExternalPackage(imp));
    const packageNames = [...new Set(externalImports.map(imp => this.getPackageName(imp)))];

    // Detect project type
    const projectType = this.detectProjectType(workspaceRoot);

    // Check which packages are missing
    const missing: string[] = [];
    
    for (const packageName of packageNames) {
      let isInstalled = false;

      if (projectType === 'npm') {
        isInstalled = this.isNpmPackageInstalled(packageName, workspaceRoot);
      } else if (projectType === 'foundry') {
        isInstalled = this.isFoundryPackageInstalled(packageName, workspaceRoot);
      }

      if (!isInstalled) {
        missing.push(packageName);
      }
    }

    // Generate install command
    const installCommand = this.generateInstallCommand(missing, projectType);

    return {
      missing,
      projectType,
      installCommand,
    };
  }

  /**
   * Generate installation command based on project type and missing packages
   */
  private static generateInstallCommand(packages: string[], projectType: 'npm' | 'foundry' | 'unknown'): string {
    if (packages.length === 0) {
      return '';
    }

    if (projectType === 'foundry') {
      // Foundry uses forge install
      // Map common npm package names to Foundry remappings
      const foundryPackages = packages.map(pkg => {
        if (pkg === '@openzeppelin/contracts') {
          return 'OpenZeppelin/openzeppelin-contracts';
        }
        // Add more mappings as needed
        return pkg;
      });
      
      return foundryPackages.map(pkg => `forge install ${pkg}`).join(' && ');
    } else if (projectType === 'npm') {
      // npm/Hardhat uses npm install
      return `npm install ${packages.join(' ')}`;
    } else {
      // Unknown project type, suggest both
      return `npm install ${packages.join(' ')} (for npm/Hardhat) or forge install (for Foundry)`;
    }
  }

  /**
   * Show helpful error message with installation instructions
   */
  public static showDependencyError(result: DependencyCheckResult): void {
    if (result.missing.length === 0) {
      return;
    }

    const missingList = result.missing.map(pkg => `  • ${pkg}`).join('\n');
    const message = `Missing dependencies detected:\n\n${missingList}\n\nTo install, run:\n${result.installCommand}`;

    vscode.window.showErrorMessage(
      `Missing ${result.missing.length} package(s). Click "Install" to copy the command.`,
      'Install',
      'Dismiss'
    ).then(selection => {
      if (selection === 'Install') {
        vscode.env.clipboard.writeText(result.installCommand);
        vscode.window.showInformationMessage(`Command copied to clipboard: ${result.installCommand}`);
      }
    });

    // Also log detailed info to console
    console.error('[DependencyChecker] Missing dependencies:');
    console.error(message);
  }

  /**
   * Parse compilation error to detect if it's due to missing imports
   */
  public static isMissingImportError(error: string): boolean {
    const missingImportPatterns = [
      /File import callback not supported/i,
      /Source.*not found/i,
      /File not found/i,
      /Could not resolve/i,
      /Cannot find module/i,
      /ENOENT.*node_modules/i,
    ];

    return missingImportPatterns.some(pattern => pattern.test(error));
  }
}
