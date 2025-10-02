import fs from "fs";
import path from "path";

export function findImports(filePath: string) {
  return (importPath: string) => {
    try {
      if (importPath.startsWith("@openzeppelin/")) {
        // Assume node_modules is in the parent directory of the contracts folder
        const projectRoot = path.resolve(path.dirname(filePath), "..");
        const depPath = path.resolve(projectRoot, "node_modules", importPath);
        console.log("Trying to read OpenZeppelin import from:", depPath);
        const content = fs.readFileSync(depPath, "utf-8");
        return { contents: content };
      }
      // Handle local imports (e.g., "./AnotherContract.sol")
      const localPath = path.resolve(path.dirname(filePath), importPath);
      const content = fs.readFileSync(localPath, "utf-8");
      return { contents: content };
    } catch (error: any) {
      console.error(`Error resolving import ${importPath}:`, error);
      return { error: `Error reading import ${importPath}: ${error.message}` };
    }
  };
}