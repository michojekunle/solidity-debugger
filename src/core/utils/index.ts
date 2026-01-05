import fs from "fs";
import path from "path";

/**
 * Cache for remappings to avoid re-reading files
 */
const remappingsCache = new Map<string, Map<string, string>>();

/**
 * Find and resolve Solidity imports from various project structures
 */
export function findImports(filePath: string) {
  return (importPath: string) => {
    try {
      const fileDir = path.dirname(filePath);
      const projectRoot = findProjectRoot(fileDir);
      
      console.log(`[Import Resolver] Resolving: ${importPath}`);
      console.log(`[Import Resolver] Project root: ${projectRoot}`);
      
      // 1. Check Foundry remappings first (remappings.txt)
      const remappedPath = resolveRemapping(importPath, projectRoot);
      if (remappedPath && fs.existsSync(remappedPath)) {
        console.log(`[Import Resolver] Found via remapping: ${remappedPath}`);
        return { contents: fs.readFileSync(remappedPath, "utf-8") };
      }

      // 2. Handle @-prefixed imports (npm packages like @openzeppelin)
      if (importPath.startsWith("@")) {
        const resolved = resolveNodeModulesImport(importPath, fileDir, projectRoot);
        if (resolved) {
          console.log(`[Import Resolver] Found in node_modules: ${resolved}`);
          return { contents: fs.readFileSync(resolved, "utf-8") };
        }
        
        // Try Foundry lib folder for OpenZeppelin
        const libResolved = resolveFoundryLib(importPath, projectRoot);
        if (libResolved) {
          console.log(`[Import Resolver] Found in Foundry lib: ${libResolved}`);
          return { contents: fs.readFileSync(libResolved, "utf-8") };
        }
      }

      // 3. Handle relative imports (./something, ../something)
      if (importPath.startsWith(".")) {
        const relativePath = path.resolve(fileDir, importPath);
        if (fs.existsSync(relativePath)) {
          console.log(`[Import Resolver] Found relative: ${relativePath}`);
          return { contents: fs.readFileSync(relativePath, "utf-8") };
        }
      }

      // 4. Handle absolute-style local imports (interfaces/IFoo.sol)
      const localResolved = resolveLocalImport(importPath, fileDir, projectRoot);
      if (localResolved) {
        console.log(`[Import Resolver] Found local: ${localResolved}`);
        return { contents: fs.readFileSync(localResolved, "utf-8") };
      }

      // 5. Last resort: try node_modules for non-@ packages
      const nodeResolved = resolveNodeModulesImport(importPath, fileDir, projectRoot);
      if (nodeResolved) {
        console.log(`[Import Resolver] Found in node_modules (fallback): ${nodeResolved}`);
        return { contents: fs.readFileSync(nodeResolved, "utf-8") };
      }

      console.error(`[Import Resolver] Failed to resolve: ${importPath}`);
      return { error: `File not found: ${importPath}. Searched in node_modules and local paths.` };

    } catch (error: any) {
      console.error(`[Import Resolver] Error resolving ${importPath}:`, error);
      return { error: `Error reading import ${importPath}: ${error.message}` };
    }
  };
}

/**
 * Find project root by looking for config files
 * Walks up the directory tree until it finds a marker file
 */
function findProjectRoot(currentDir: string): string {
  const markers = [
    "package.json",
    "foundry.toml", 
    "hardhat.config.js",
    "hardhat.config.ts",
    "truffle-config.js",
    "brownie-config.yaml",
    "remappings.txt"
  ];

  if (markers.some(marker => fs.existsSync(path.join(currentDir, marker)))) {
    return currentDir;
  }

  const parentDir = path.dirname(currentDir);
  if (parentDir === currentDir) {
    // Reached filesystem root, return original dir
    return currentDir;
  }
  
  return findProjectRoot(parentDir);
}

/**
 * Resolve Foundry-style remappings from remappings.txt
 */
function resolveRemapping(importPath: string, projectRoot: string): string | null {
  const remappingsFile = path.join(projectRoot, "remappings.txt");
  
  if (!fs.existsSync(remappingsFile)) {
    return null;
  }

  // Use cached remappings if available
  let remappings = remappingsCache.get(projectRoot);
  if (!remappings) {
    remappings = new Map();
    const content = fs.readFileSync(remappingsFile, "utf-8");
    
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      
      const [from, to] = trimmed.split("=");
      if (from && to) {
        remappings.set(from.trim(), to.trim());
      }
    }
    
    remappingsCache.set(projectRoot, remappings);
  }

  // Find matching remapping (longest prefix wins)
  let bestMatch = "";
  let bestReplacement = "";
  
  for (const [from, to] of remappings) {
    if (importPath.startsWith(from) && from.length > bestMatch.length) {
      bestMatch = from;
      bestReplacement = to;
    }
  }

  if (bestMatch) {
    const resolvedPath = path.join(projectRoot, importPath.replace(bestMatch, bestReplacement));
    return resolvedPath;
  }

  return null;
}

/**
 * Resolve imports from node_modules, searching up the directory tree AND in subdirectories
 * This handles monorepos, workspaces, and projects with nested contract folders
 */
function resolveNodeModulesImport(importPath: string, startDir: string, projectRoot: string): string | null {
  // 1. Search up the directory tree for node_modules
  let currentDir = startDir;
  
  while (true) {
    const nodeModulesPath = path.join(currentDir, "node_modules", importPath);
    
    if (fs.existsSync(nodeModulesPath)) {
      return nodeModulesPath;
    }

    // Stop at project root or filesystem root
    if (currentDir === projectRoot || currentDir === path.dirname(currentDir)) {
      break;
    }
    
    currentDir = path.dirname(currentDir);
  }

  // 2. Also check one level above project root for workspace setups
  const parentNodeModules = path.join(path.dirname(projectRoot), "node_modules", importPath);
  if (fs.existsSync(parentNodeModules)) {
    return parentNodeModules;
  }

  // 3. Search in common sub-project directories
  const subProjectPatterns = [
    "smart-contract",
    "smart-contracts",
    "contracts",
    "blockchain",
    "hardhat",
    "foundry",
    "packages/contracts",
    "packages/hardhat",
    "apps/contracts",
    "backend",
    "ethereum",
  ];

  for (const pattern of subProjectPatterns) {
    const subProjectNodeModules = path.join(projectRoot, pattern, "node_modules", importPath);
    if (fs.existsSync(subProjectNodeModules)) {
      return subProjectNodeModules;
    }
  }

  // 4. Recursive search for any node_modules in subdirectories (limited depth)
  const foundNodeModules = findAllNodeModulesDirectories(projectRoot, 3);
  for (const nodeModulesDir of foundNodeModules) {
    const pkgPath = path.join(nodeModulesDir, importPath);
    if (fs.existsSync(pkgPath)) {
      return pkgPath;
    }
  }

  return null;
}

/**
 * Recursively find all node_modules directories in the project
 */
function findAllNodeModulesDirectories(rootDir: string, maxDepth: number): string[] {
  const nodeModulesDirs: string[] = [];
  
  function search(dir: string, depth: number) {
    if (depth > maxDepth) return;
    
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        
        const fullPath = path.join(dir, entry.name);
        
        // If it's a node_modules, add it but don't descend into it
        if (entry.name === 'node_modules') {
          nodeModulesDirs.push(fullPath);
          continue;
        }
        
        // Skip other non-relevant directories
        if (['.git', 'cache', 'artifacts', 'out', 'build', 'dist'].includes(entry.name)) {
          continue;
        }
        
        // Recurse into subdirectory
        search(fullPath, depth + 1);
      }
    } catch {
      // Ignore permission errors
    }
  }
  
  search(rootDir, 0);
  return nodeModulesDirs;
}

/**
 * Resolve Foundry lib folder imports (e.g., @openzeppelin -> lib/openzeppelin-contracts)
 */
function resolveFoundryLib(importPath: string, projectRoot: string): string | null {
  const libDir = path.join(projectRoot, "lib");
  
  if (!fs.existsSync(libDir)) {
    return null;
  }

  // Common mappings for Foundry projects
  const foundryMappings: Record<string, string[]> = {
    "@openzeppelin/contracts": ["openzeppelin-contracts/contracts", "openzeppelin/contracts"],
    "@openzeppelin/contracts-upgradeable": ["openzeppelin-contracts-upgradeable/contracts"],
    "@chainlink/contracts": ["chainlink/contracts"],
    "@uniswap/v2-core": ["v2-core"],
    "@uniswap/v3-core": ["v3-core"],
  };

  for (const [prefix, libPaths] of Object.entries(foundryMappings)) {
    if (importPath.startsWith(prefix)) {
      const remainder = importPath.slice(prefix.length);
      
      for (const libPath of libPaths) {
        const fullPath = path.join(libDir, libPath, remainder);
        if (fs.existsSync(fullPath)) {
          return fullPath;
        }
      }
    }
  }

  return null;
}

/**
 * Resolve local project imports (e.g., "interfaces/IFoo.sol")
 * Recursively searches common project structures
 */
function resolveLocalImport(importPath: string, fileDir: string, projectRoot: string): string | null {
  // First, try direct search in common directories
  const directDirs = [
    fileDir,                                    // Same directory as importing file
    projectRoot,                                // Project root
    path.join(projectRoot, "src"),              // Foundry style
    path.join(projectRoot, "contracts"),        // Hardhat style  
    path.join(projectRoot, "lib"),              // Library folder
    path.join(projectRoot, "src", "contracts"), // Nested contracts
  ];

  for (const dir of directDirs) {
    const fullPath = path.join(dir, importPath);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  // Recursively search common sub-project patterns
  const subProjectPatterns = [
    "smart-contract",
    "smart-contracts", 
    "blockchain",
    "hardhat",
    "foundry",
    "packages/contracts",
    "packages/hardhat",
    "apps/contracts",
  ];

  for (const pattern of subProjectPatterns) {
    const subProjectRoot = path.join(projectRoot, pattern);
    if (fs.existsSync(subProjectRoot)) {
      const subDirs = [
        subProjectRoot,
        path.join(subProjectRoot, "contracts"),
        path.join(subProjectRoot, "src"),
        path.join(subProjectRoot, "src", "contracts"),
      ];
      
      for (const dir of subDirs) {
        const fullPath = path.join(dir, importPath);
        if (fs.existsSync(fullPath)) {
          return fullPath;
        }
      }
      
      // Also check node_modules in sub-project
      const subNodeModules = path.join(subProjectRoot, "node_modules", importPath);
      if (fs.existsSync(subNodeModules)) {
        return subNodeModules;
      }
    }
  }

  // Recursive search for deeply nested projects
  const allContractDirs = findContractDirectories(projectRoot, 3);
  for (const contractDir of allContractDirs) {
    const fullPath = path.join(contractDir, importPath);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  return null;
}

/**
 * Recursively find directories containing Solidity contracts
 */
function findContractDirectories(rootDir: string, maxDepth: number): string[] {
  const contractDirs: string[] = [];
  
  function search(dir: string, depth: number) {
    if (depth > maxDepth) return;
    
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      // Check if this directory contains .sol files
      const hasSolFiles = entries.some(e => e.isFile() && e.name.endsWith('.sol'));
      if (hasSolFiles) {
        contractDirs.push(dir);
      }
      
      // Recurse into subdirectories (skip node_modules, lib, .git)
      for (const entry of entries) {
        if (entry.isDirectory() && 
            !['node_modules', 'lib', '.git', 'cache', 'artifacts', 'out', 'build'].includes(entry.name)) {
          search(path.join(dir, entry.name), depth + 1);
        }
      }
    } catch {
      // Ignore permission errors
    }
  }
  
  search(rootDir, 0);
  return contractDirs;
}

/**
 * Clear the remappings cache (useful for testing or when files change)
 */
export function clearRemappingsCache(): void {
  remappingsCache.clear();
}
