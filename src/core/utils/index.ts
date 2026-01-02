import fs from "fs";
import path from "path";

export function findImports(filePath: string) {
      return (importPath: string) => {
    try {
      const projectRoot = findProjectRoot(path.dirname(filePath));
      
      // 1. Handle OpenZeppelin and other node_modules imports
      if (importPath.startsWith("@")) {
        // Try node_modules first
        const nodeModulesPath = path.join(projectRoot, "node_modules", importPath);
        if (fs.existsSync(nodeModulesPath)) {
            return { contents: fs.readFileSync(nodeModulesPath, "utf-8") };
        }
        
        // Try OpenZeppelin remapping in lib (common in Foundry)
        if (importPath.startsWith("@openzeppelin/")) {
             const libPath = path.join(projectRoot, "lib", "openzeppelin-contracts", importPath.replace("@openzeppelin/", ""));
             const fixedLibPath = libPath.includes("contracts/contracts") ? libPath.replace("contracts/contracts", "contracts") : libPath;
             
             if (fs.existsSync(fixedLibPath)) {
                  return { contents: fs.readFileSync(fixedLibPath, "utf-8") };
             }
        }
      } 
      
      // 2. Handle absolute/non-relative imports that might be local files (e.g. "interfaces/Iface.sol")
      if (!importPath.startsWith(".")) {
          // Check node_modules first (standard behavior)
          const nodeModulesPath = path.join(projectRoot, "node_modules", importPath);
          if (fs.existsSync(nodeModulesPath)) {
              return { contents: fs.readFileSync(nodeModulesPath, "utf-8") };
          }

          // Check common source directories
          const searchPaths = [
              path.join(projectRoot, importPath),             // Root relative
              path.join(projectRoot, "src", importPath),      // Foundry style
              path.join(projectRoot, "contracts", importPath), // Hardhat style
              path.join(projectRoot, "lib", importPath)       // Library style
          ];

          for (const searchPath of searchPaths) {
              if (fs.existsSync(searchPath)) {
                  return { contents: fs.readFileSync(searchPath, "utf-8") };
              }
          }
      }

      // 3. Handle relative imports
      // Resolve relative to the importing file
      const localPath = path.resolve(path.dirname(filePath), importPath);
      if (fs.existsSync(localPath)) {
        return { contents: fs.readFileSync(localPath, "utf-8") };
      }
      
      return { error: `File not found in node_modules or local path: ${importPath}` };

    } catch (error: any) {
      console.error(`Error resolving import ${importPath}:`, error);
      return { error: `Error reading import ${importPath}: ${error.message}` };
    }
  };
}

function findProjectRoot(currentDir: string): string {
    if (fs.existsSync(path.join(currentDir, "package.json")) || 
        fs.existsSync(path.join(currentDir, "foundry.toml")) ||
        fs.existsSync(path.join(currentDir, "hardhat.config.js")) ||
        fs.existsSync(path.join(currentDir, "hardhat.config.ts"))) {
        return currentDir;
    }
    
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) return currentDir; // Root reached
    return findProjectRoot(parentDir);
}
