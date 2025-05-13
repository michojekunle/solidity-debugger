import * as vscode from "vscode";
import {
  DebugAdapterDescriptorFactory,
  DebugAdapterDescriptor,
  DebugAdapterServer,
} from "vscode";
import { HardhatDebugAdapter } from "./hardhatAdapter";
import { FoundryDebugAdapter } from "./foundryAdapter";
import { StateCollector } from "../stateProcessor/stateCollector";
import path from "path";

export class SolidityDebuggerProvider implements DebugAdapterDescriptorFactory {
  private hardhatAdapter?: HardhatDebugAdapter;
  private foundryAdapter?: FoundryDebugAdapter;
  private stateCollector: StateCollector;
  private server?: DebugAdapterServer;

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
    console.log(`Debug session configuration:`, config);

    // Extract contract path, if specified
    const contractPath = config.contractPath || "";
    const networkName = config.networkName || "localhost";
    const customArgs = config.additionalArgs || [];

    try {
      // Determine which debugger to use based on the project configuration
      // Allow overriding auto-detection via debugger type in launch.json
      if (
        config.debuggerType === "hardhat" ||
        (config.debuggerType !== "foundry" && (await this.isHardhatProject()))
      ) {
        return this.createHardhatDebugAdapter(session, workspaceRoot);
      } else if (
        config.debuggerType === "foundry" ||
        (await this.isFoundryProject())
      ) {
        return this.createFoundryDebugAdapter(session, workspaceRoot);
      } else {
        throw new Error(
          "Unsupported Solidity project type. Please use Hardhat or Foundry."
        );
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Debugger error: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  private async isHardhatProject(): Promise<boolean> {
    // Check if hardhat.config.js/ts exists
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return false;
    }

    // Check for both .js and .ts config files
    const hardhatConfigJs = vscode.Uri.joinPath(
      workspaceFolders[0].uri,
      "hardhat.config.js"
    );

    const hardhatConfigTs = vscode.Uri.joinPath(
      workspaceFolders[0].uri,
      "hardhat.config.ts"
    );

    try {
      // Check for JS version
      try {
        const jsFileStat = await vscode.workspace.fs.stat(hardhatConfigJs);
        if (jsFileStat.type === vscode.FileType.File) {
          return true;
        }
      } catch {
        // JS version not found, continue to check TS version
      }

      // Check for TS version
      const tsFileStat = await vscode.workspace.fs.stat(hardhatConfigTs);
      return tsFileStat.type === vscode.FileType.File;
    } catch {
      return false;
    }
  }

  private async isFoundryProject(): Promise<boolean> {
    // Check if foundry.toml exists
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return false;
    }

    const foundryTomlPath = vscode.Uri.joinPath(
      workspaceFolders[0].uri,
      "foundry.toml"
    );

    try {
      const fileStat = await vscode.workspace.fs.stat(foundryTomlPath);
      return fileStat.type === vscode.FileType.File;
    } catch {
      return false;
    }
  }

  private async createHardhatDebugAdapter(
    session: vscode.DebugSession,
    workspaceRoot: string
  ): Promise<DebugAdapterDescriptor> {
    try {
      // Extract config from debug session
      const config = session.configuration;
      const contractFile = config.contractPath || "";
      const networkName = config.networkName || "localhost";
      const additionalArgs = config.additionalArgs || [];

      // Clean up any existing adapter
      if (this.hardhatAdapter) {
        await this.hardhatAdapter.stop();
      }

      // Create new instance of adapter
      this.hardhatAdapter = new HardhatDebugAdapter(
        workspaceRoot,
        this.stateCollector
      );

      // Configure state collector with active contract if specified
      if (contractFile) {
        // If a specific contract file is provided, analyze it
        if (await this.loadContractIntoStateCollector(contractFile)) {
          console.log(`Loaded contract ${contractFile} into state collector`);
        }
      }

      // Start the hardhat node with custom arguments from debug config
      const startArgs = ["hardhat", "node", "--verbose"];

      // Add network selection if specified
      if (networkName !== "localhost") {
        startArgs.push("--network", networkName);
      }

      // Add any additional arguments from debug configuration
      startArgs.push(...additionalArgs);

      // Start the hardhat node and get the debug port
      const port = await this.hardhatAdapter.start(startArgs);

      // Register the debug session in the state collector for context
      this.stateCollector.collectDebugState(session);

      // Connect to the debug server
      await this.hardhatAdapter.connect(port);

      // Log debugging information
      console.log(
        `Hardhat Debug Adapter started on port: ${port} for contract: ${
          contractFile || "not specified"
        }`
      );

      // Return the debug adapter server descriptor
      this.server = new DebugAdapterServer(port, "localhost");
      return this.server;
    } catch (error) {
      console.error("Failed to create Hardhat debug adapter:", error);
      vscode.window.showErrorMessage(
        `Failed to start Hardhat debugger: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  private async createFoundryDebugAdapter(
    session: vscode.DebugSession,
    workspaceRoot: string
  ): Promise<DebugAdapterDescriptor> {
    try {
      // Extract config from debug session
      const config = session.configuration;
      const contractFile = config.contractPath || "";
      const additionalArgs = config.additionalArgs || [];

      // Clean up any existing adapter
      if (this.foundryAdapter) {
        await this.foundryAdapter.stop();
      }

      // Create new instance of adapter
      this.foundryAdapter = new FoundryDebugAdapter(
        workspaceRoot,
        this.stateCollector
      );

      // Configure state collector with active contract if specified
      if (contractFile) {
        // If a specific contract file is provided, analyze it
        if (await this.loadContractIntoStateCollector(contractFile)) {
          console.log(`Loaded contract ${contractFile} into state collector`);
        }
      }

      // Start the Foundry anvil with custom arguments from debug config
      const startArgs = ["--verbose"];

      // Add any additional arguments from debug configuration
      startArgs.push(...additionalArgs);

      // Start the Foundry anvil node and get the debug port
      const port = await this.foundryAdapter.start(startArgs);

      // Register the debug session in the state collector for context
      this.stateCollector.collectDebugState(session);

      // Connect to the debug server
      await this.foundryAdapter.connect(port);

      // Log debugging information
      console.log(
        `Foundry Debug Adapter started on port: ${port} for contract: ${
          contractFile || "not specified"
        }`
      );

      // Return the debug adapter server descriptor
      this.server = new DebugAdapterServer(port, "localhost");
      return this.server;
    } catch (error) {
      console.error("Failed to create Foundry debug adapter:", error);
      vscode.window.showErrorMessage(
        `Failed to start Foundry debugger: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  /**
   * Helper method to load contract information into the state collector
   */
  private async loadContractIntoStateCollector(
    contractPath: string
  ): Promise<boolean> {
    try {
      // Find the contract file in the workspace
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        return false;
      }

      // Try to find the contract file
      let contractUri: vscode.Uri | undefined;

      // Check if it's an absolute path
      if (path.isAbsolute(contractPath)) {
        contractUri = vscode.Uri.file(contractPath);
      } else {
        // Try relative to workspace root
        contractUri = vscode.Uri.joinPath(
          workspaceFolders[0].uri,
          contractPath
        );
      }

      // Check if the file exists
      try {
        await vscode.workspace.fs.stat(contractUri);
      } catch {
        console.error(`Contract file not found: ${contractPath}`);
        return false;
      }

      // Create a text document with the contract content
      const document = await vscode.workspace.openTextDocument(contractUri);

      // Create a temporary editor to analyze the contract
      // We don't actually show the editor to the user
      // Simulating as if the file was opened in the editor
      const fakeEditor = {
        document: document,
      } as vscode.TextEditor;

      // Use the fake editor to analyze the contract with the state collector
      // This will extract storage layout and ABI information
      return await this.stateCollector.analyzeActiveContract();
    } catch (error) {
      console.error("Error loading contract into state collector:", error);
      return false;
    }
  }

  async dispose() {
    // Clean up resources
    try {
      if (this.hardhatAdapter) {
        await this.hardhatAdapter.stop();
        this.hardhatAdapter = undefined;
      }

      if (this.foundryAdapter) {
        await this.foundryAdapter.stop();
        this.foundryAdapter = undefined;
      }

      // Release the state collector resources
      this.stateCollector.dispose();
    } catch (error) {
      console.error("Error during debugger provider cleanup:", error);
    }
  }
}
