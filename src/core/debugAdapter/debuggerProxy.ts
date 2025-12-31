import * as vscode from "vscode";
import {
  DebugAdapterDescriptorFactory,
  DebugAdapterDescriptor,
  DebugAdapterInlineImplementation,
} from "vscode";
import { SolidityDebugSession } from "./solidityDebugSession";
import { HardhatDebugAdapter } from "./hardhatAdapter";
import { FoundryDebugAdapter } from "./foundryAdapter";
import { StateCollector } from "../stateProcessor/stateCollector";
import path from "path";

export class SolidityDebuggerProvider implements DebugAdapterDescriptorFactory {
  // Runtime managers
  private hardhatAdapter?: HardhatDebugAdapter;
  private foundryAdapter?: FoundryDebugAdapter;
  
  private stateCollector: StateCollector;

  constructor(private context: vscode.ExtensionContext) {
    // Initialize the state collector
    this.stateCollector = new StateCollector(context);

    // Register for vscode deactivation to clean up resources
    context.subscriptions.push(this);
  }

  async createDebugAdapterDescriptor(
    session: vscode.DebugSession
  ): Promise<DebugAdapterDescriptor> {
    // Get the workspace root path
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      throw new Error("No workspace folder found");
    }
    const workspaceRoot = workspaceFolders[0].uri.fsPath;

    // Extract configuration from the debug session
    const config = session.configuration;
    const contractPath = config.contractPath || "";
    
    // 1. Ensure the contract is analyzed properly before starting
    if (contractPath) {
      await this.loadContractIntoStateCollector(contractPath);
    } else {
      // Try to analyze the currently open file if no path specified
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor && activeEditor.document.languageId === 'solidity') {
        await this.stateCollector.analyzeActiveContract();
      }
    }

    try {
      // 2. Start the appropriate underlying node/chain (Hardhat/Foundry)
      // This is now purely for "runtime" purposes (providing JSON-RPC)
      // The DAP session will talk to this runtime via the StateCollector eventually
      
      if (
        config.debuggerType === "hardhat" ||
        (config.debuggerType !== "foundry" && (await this.isHardhatProject()))
      ) {
         await this.ensureHardhatRunning(workspaceRoot, config);
      } else if (
        config.debuggerType === "foundry" ||
        (await this.isFoundryProject())
      ) {
         await this.ensureFoundryRunning(workspaceRoot, config);
      }

      // 3. Return the Inline Debug Adapter that VS Code will communicate with
      // This session "speaks" DAP and uses StateCollector/Runtime to do the work.
      return new DebugAdapterInlineImplementation(
        new SolidityDebugSession(workspaceRoot, this.stateCollector)
      );

    } catch (error) {
      vscode.window.showErrorMessage(
        `Debugger error: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  private async ensureHardhatRunning(workspaceRoot: string, _config: any) {
      if (!this.hardhatAdapter) {
         this.hardhatAdapter = new HardhatDebugAdapter(workspaceRoot, this.stateCollector);
      }
      
      const args = ["hardhat", "node"];
      // Add custom args if needed
      
      // We don't force a connect here anymore, the session will handle it potentially
      // or we can start it "headless" just to have the RPC available
      await this.hardhatAdapter.start(args);
      console.log("Hardhat Node started for Debug Session");
  }

  private async ensureFoundryRunning(workspaceRoot: string, _config: any) {
      if (!this.foundryAdapter) {
          this.foundryAdapter = new FoundryDebugAdapter(workspaceRoot, this.stateCollector);
      }
      const args = ["--verbose"];
      await this.foundryAdapter.start(args);
      console.log("Foundry Anvil started for Debug Session");
  }

  private async isHardhatProject(): Promise<boolean> {
    // Check if hardhat.config.js/ts exists
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return false;

    const hardhatConfigJs = vscode.Uri.file(path.join(workspaceFolders[0].uri.fsPath, "hardhat.config.js"));
    const hardhatConfigTs = vscode.Uri.file(path.join(workspaceFolders[0].uri.fsPath, "hardhat.config.ts"));

    try {
      try {
        const jsFileStat = await vscode.workspace.fs.stat(hardhatConfigJs);
        if (jsFileStat.type === vscode.FileType.File) return true;
      } catch {}

      const tsFileStat = await vscode.workspace.fs.stat(hardhatConfigTs);
      return tsFileStat.type === vscode.FileType.File;
    } catch {
      return false;
    }
  }

  private async isFoundryProject(): Promise<boolean> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return false;

    const foundryTomlPath = vscode.Uri.file(path.join(workspaceFolders[0].uri.fsPath, "foundry.toml"));
    try {
      const fileStat = await vscode.workspace.fs.stat(foundryTomlPath);
      return fileStat.type === vscode.FileType.File;
    } catch {
      return false;
    }
  }

  /**
   * Helper method to load contract information into the state collector
   */
  private async loadContractIntoStateCollector(
    contractPath: string
  ): Promise<boolean> {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) return false;

      let contractUri: vscode.Uri | undefined;
      if (path.isAbsolute(contractPath)) {
        contractUri = vscode.Uri.file(contractPath);
      } else {
        contractUri = vscode.Uri.file(path.join(workspaceFolders[0].uri.fsPath, contractPath));
      }

      await vscode.workspace.fs.stat(contractUri);
      const document = await vscode.workspace.openTextDocument(contractUri);
      
      // Activate the editor so validation can grab it
      await vscode.window.showTextDocument(document); 

      return await this.stateCollector.analyzeActiveContract();
    } catch (error) {
      console.error("Error loading contract into state collector:", error);
      return false;
    }
  }

  async dispose() {
    try {
      if (this.hardhatAdapter) {
        await this.hardhatAdapter.stop();
        this.hardhatAdapter = undefined;
      }
      if (this.foundryAdapter) {
        await this.foundryAdapter.stop();
        this.foundryAdapter = undefined;
      }
      this.stateCollector.dispose();
    } catch (error) {
      console.error("Error during debugger provider cleanup:", error);
    }
  }
}
