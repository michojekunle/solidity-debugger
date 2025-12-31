import * as solc from "solc"
import * as path from "path"
import { findImports } from "./index"

export class Compiler {
  public static async compile(source: string, filePath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        if (!source || !filePath) {
          reject(new Error("Source code and file path are required for compilation"))
          return
        }

        const fileName = path.basename(filePath)
        const input = {
          language: "Solidity",
          sources: {
            [fileName]: {
              content: source,
            },
          },
          settings: {
            outputSelection: {
              "*": {
                "*": ["abi", "evm.bytecode", "storageLayout"],
              },
            },
          },
        }

        const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports(filePath) }))

        if (output.errors) {
          const hasError = output.errors.some((error: any) => error.severity === "error")
          if (hasError) {
            reject(new Error("Compilation failed: " + output.errors.map((e: any) => e.message).join("; ")))
            return
          }
        }

        resolve(output)
      } catch (error) {
        reject(error)
      }
    })
  }

  public static getContractFromOutput(output: any, targetFilePath?: string): { contractName: string; abi: any[]; bytecode: string, storageLayout: any } | null {
      if (!output || !output.contracts) {
          console.error("[Compiler] No contracts found in compilation output");
          return null;
      }
      
      const fileNames = Object.keys(output.contracts);
      if (fileNames.length === 0) {
          console.error("[Compiler] No file names found in contracts");
          return null;
      }
      
      // Try to find the contract from the target file first
      let fileName: string;
      let contractName: string;
      
      if (targetFilePath) {
          const targetBasename = path.basename(targetFilePath);
          console.log("[Compiler] Looking for contract in target file:", targetBasename);
          
          // Find the filename that matches our target (ignoring path differences)
          fileName = fileNames.find(fn => {
              const fnBasename = fn.split('/').pop() || fn;
              return fnBasename === targetBasename;
          }) || fileNames[0];
          
          console.log("[Compiler] Selected file:", fileName);
      } else {
          fileName = fileNames[0];
      }
      
      const contractNames = Object.keys(output.contracts[fileName]);
      if (contractNames.length === 0) {
          console.error("[Compiler] No contract names found in file:", fileName);
          return null;
      }
      
      // If multiple contracts in the file, prefer non-abstract/non-library contracts
      if (contractNames.length > 1) {
          console.log("[Compiler] Multiple contracts found:", contractNames);
          
          // Try to find a concrete contract (one with bytecode)
          const concreteContract = contractNames.find(name => {
              const contract = output.contracts[fileName][name];
              return contract.evm?.bytecode?.object && contract.evm.bytecode.object.length > 0;
          });
          
          contractName = concreteContract || contractNames[0];
          console.log("[Compiler] Selected contract:", contractName);
      } else {
          contractName = contractNames[0];
      }
      
      const contract = output.contracts[fileName][contractName];
      
      // Extract bytecode with multiple fallback strategies
      let bytecode = '';
      if (contract.evm?.bytecode?.object) {
          bytecode = contract.evm.bytecode.object;
      } else if (contract.evm?.bytecode) {
          // Some solc versions return bytecode directly as a string
          bytecode = typeof contract.evm.bytecode === 'string' ? contract.evm.bytecode : '';
      } else if (contract.bytecode) {
          // Fallback for older solc versions
          bytecode = typeof contract.bytecode === 'string' ? contract.bytecode : contract.bytecode.object || '';
      }
      
      if (!bytecode) {
          console.error("[Compiler] Could not extract bytecode from contract:", contractName);
          console.error("[Compiler] Contract structure:", JSON.stringify(contract, null, 2));
      }
      
      return {
          contractName,
          abi: contract.abi || [],
          bytecode,
          storageLayout: contract.storageLayout
      };
  }
}

