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
   * Searches recursively through common subdirectory patterns
   */
  private static isNpmPackageInstalled(packageName: string, workspaceRoot: string): boolean {
    console.log(`[DependencyChecker] Checking npm package: ${packageName}`);
    console.log(`[DependencyChecker] Workspace root: ${workspaceRoot}`);
    
    // Direct check in workspace root
    const rootNodeModules = path.join(workspaceRoot, 'node_modules', ...packageName.split('/'));
    console.log(`[DependencyChecker] Checking root: ${rootNodeModules}`);
    if (fs.existsSync(rootNodeModules)) {
      console.log(`[DependencyChecker] ✓ Found in root node_modules`);
      return true;
    }

    // Search in common subdirectory patterns
    const searchDirs = [
      'smart-contract',
      'smart-contracts',
      'contracts',
      'blockchain',
      'hardhat',
      'packages/contracts',
      'packages/hardhat',
      'apps/contracts',
      'backend',
      'ethereum',
    ];

    console.log(`[DependencyChecker] Checking common subdirs...`);
    for (const subDir of searchDirs) {
      const subDirNodeModules = path.join(workspaceRoot, subDir, 'node_modules', ...packageName.split('/'));
      if (fs.existsSync(subDirNodeModules)) {
        console.log(`[DependencyChecker] ✓ Found in ${subDir}/node_modules`);
        return true;
      }
    }

    // Recursive search for node_modules directories (limited depth)
    console.log(`[DependencyChecker] Recursive search for node_modules...`);
    const foundNodeModules = this.findNodeModulesDirectories(workspaceRoot, 3);
    console.log(`[DependencyChecker] Found ${foundNodeModules.length} node_modules directories:`, foundNodeModules);
    
    for (const nodeModulesDir of foundNodeModules) {
      const pkgPath = path.join(nodeModulesDir, ...packageName.split('/'));
      console.log(`[DependencyChecker] Checking: ${pkgPath}`);
      if (fs.existsSync(pkgPath)) {
        console.log(`[DependencyChecker] ✓ Found at ${pkgPath}`);
        return true;
      }
    }

    console.log(`[DependencyChecker] ✗ Package NOT found: ${packageName}`);
    return false;
  }

  /**
   * Recursively find all node_modules directories in the project
   */
  private static findNodeModulesDirectories(rootDir: string, maxDepth: number): string[] {
    const nodeModulesDirs: string[] = [];
    console.log(`[DependencyChecker] Starting recursive search from: ${rootDir} (maxDepth: ${maxDepth})`);
    
    const search = (dir: string, depth: number) => {
      if (depth > maxDepth) {
        return;
      }
      
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          if (!entry.isDirectory()) {
            continue;
          }
          
          const fullPath = path.join(dir, entry.name);
          
          // Skip certain directories to avoid infinite loops
          if (['node_modules', '.git', 'cache', 'artifacts', 'out', 'build', 'dist'].includes(entry.name)) {
            // If it's a node_modules, add it to our list but don't descend into it
            if (entry.name === 'node_modules') {
              console.log(`[DependencyChecker]   Found node_modules at depth ${depth}: ${fullPath}`);
              nodeModulesDirs.push(fullPath);
            }
            continue;
          }
          
          // Check if this directory contains node_modules
          const nodeModulesPath = path.join(fullPath, 'node_modules');
          if (fs.existsSync(nodeModulesPath)) {
            console.log(`[DependencyChecker]   Found node_modules in ${entry.name}: ${nodeModulesPath}`);
            nodeModulesDirs.push(nodeModulesPath);
          }
          
          // Recurse into subdirectory
          search(fullPath, depth + 1);
        }
      } catch (e) {
        console.log(`[DependencyChecker] Error reading dir ${dir}: ${e}`);
      }
    };
    
    search(rootDir, 0);
    console.log(`[DependencyChecker] Total node_modules found: ${nodeModulesDirs.length}`);
    return nodeModulesDirs;
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
    console.log(`[DependencyChecker] ========== Starting dependency check ==========`);
    console.log(`[DependencyChecker] File path: ${filePath}`);
    
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
    const workspaceRoot = workspaceFolder?.uri.fsPath || path.dirname(filePath);
    console.log(`[DependencyChecker] Workspace folder found: ${!!workspaceFolder}`);
    console.log(`[DependencyChecker] Workspace root: ${workspaceRoot}`);

    // Extract imports
    const imports = this.extractImports(sourceCode);
    console.log(`[DependencyChecker] All imports found: ${imports.length}`);
    console.log(`[DependencyChecker] Imports:`, imports);
    
    const externalImports = imports.filter(imp => this.isExternalPackage(imp));
    console.log(`[DependencyChecker] External imports: ${externalImports.length}`);
    console.log(`[DependencyChecker] External:`, externalImports);
    
    const packageNames = [...new Set(externalImports.map(imp => this.getPackageName(imp)))];
    console.log(`[DependencyChecker] Unique packages to check: ${packageNames.length}`);
    console.log(`[DependencyChecker] Packages:`, packageNames);

    // Detect project type
    const projectType = this.detectProjectType(workspaceRoot);
    console.log(`[DependencyChecker] Detected project type: ${projectType}`);

    // Check which packages are missing
    const missing: string[] = [];
    
    for (const packageName of packageNames) {
      console.log(`[DependencyChecker] --- Checking package: ${packageName} ---`);
      let isInstalled = false;

      if (projectType === 'npm') {
        isInstalled = this.isNpmPackageInstalled(packageName, workspaceRoot);
      } else if (projectType === 'foundry') {
        isInstalled = this.isFoundryPackageInstalled(packageName, workspaceRoot);
      } else {
        // Unknown - try both
        console.log(`[DependencyChecker] Unknown project type, trying npm...`);
        isInstalled = this.isNpmPackageInstalled(packageName, workspaceRoot);
        if (!isInstalled) {
          console.log(`[DependencyChecker] Not found in npm, trying foundry...`);
          isInstalled = this.isFoundryPackageInstalled(packageName, workspaceRoot);
        }
      }

      console.log(`[DependencyChecker] ${packageName} installed: ${isInstalled}`);
      if (!isInstalled) {
        missing.push(packageName);
      }
    }

    // Generate install command
    const installCommand = this.generateInstallCommand(missing, projectType);
    
    console.log(`[DependencyChecker] ========== Dependency check complete ==========`);
    console.log(`[DependencyChecker] Missing packages: ${missing.length}`);
    console.log(`[DependencyChecker] Missing:`, missing);

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
