import * as vscode from "vscode";
import { SolidityDebuggerProvider } from "./core/debugAdapter/debuggerProxy";
import { StateVisualizerPanel } from "./webviews/panels/statePanel";
import { GasAnalyzerPanel } from "./webviews/panels/gasPanel";
import { HelpPanel } from "./webviews/panels/helpPanel";
import {
  StateCollector,
  type StateSnapshot,
} from "./core/stateProcessor/stateCollector";
import { ContractSimulator } from "./core/stateProcessor/contractSimulator";

// Global reference to the state processor service
let stateProcessorService: StateProcessorService | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log("Solidity Debugger extension is now active");

  // Register the debug adapter provider
  const provider = new SolidityDebuggerProvider(context);
  context.subscriptions.push(
    vscode.debug.registerDebugAdapterDescriptorFactory(
      "solidityDebug",
      provider
    )
  );

  // Initialize core services
  const services = initializeServices(context);
  stateProcessorService = services.stateProcessorService;

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "solidityDebugger.showStateVisualizer",
      () => {
        // Pass the state processor service to the panel
        StateVisualizerPanel.createOrShow(
          context.extensionUri,
          stateProcessorService
        );
      }
    ),
    vscode.commands.registerCommand("solidityDebugger.showGasAnalyzer", () => {
      GasAnalyzerPanel.createOrShow(context.extensionUri);
    }),
    vscode.commands.registerCommand("solidityDebugger.showHelp", () => {
      HelpPanel.createOrShow(context.extensionUri);
    })
  );
}

/**
 * Service for processing and visualizing smart contract state information
 */
export class StateProcessorService implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private stateCollector: StateCollector;
  private contractSimulator: ContractSimulator;
  private currentSnapshotId = -1;

  // Event emitters for UI updates
  private stateUpdateEmitter = new vscode.EventEmitter<{
    currentState: Record<string, any>;
    history: StateSnapshot[];
    currentStep: number;
  }>();

  // New event emitter for contract analysis
  private contractAnalyzedEmitter = new vscode.EventEmitter<{
    contractName: string;
    abi: any[];
    storageLayout: any;
  }>();

  public readonly onStateUpdated = this.stateUpdateEmitter.event;
  public readonly onContractAnalyzed = this.contractAnalyzedEmitter.event;

  constructor(context: vscode.ExtensionContext) {
    this.stateCollector = new StateCollector(context);
    this.contractSimulator = new ContractSimulator(this.stateCollector);
    this.registerEventListeners();
    this.registerCommands();
    console.log("StateProcessorService initialized");
  }

  /**
   * Register event listeners for state change events
   */
  private registerEventListeners() {
    this.disposables.push(
      this.stateCollector.onSnapshotCreated((snapshot) => {
        this.currentSnapshotId = snapshot.id;
        this.notifyStateUpdate();
      })
    );

    // Listen for contract analysis events from the state collector
    this.disposables.push(
      this.stateCollector.onContractAnalyzed((contractInfo) => {
        // When a contract is analyzed, set up the simulator with the ABI
        this.contractSimulator.setContractAbi(contractInfo.abi);

        // Forward the event to UI components
        this.contractAnalyzedEmitter.fire(contractInfo);
      })
    );
  }

  /**
   * Register commands for interacting with the state processor
   */
  private registerCommands() {
    // Command to analyze current contract state
    const analyzeStateCommand = vscode.commands.registerCommand(
      "solidityDebugger.analyzeContractState",
      () => {
        this.analyzeContractState();
      }
    );

    // Command to navigate to previous state snapshot
    const prevStateCommand = vscode.commands.registerCommand(
      "solidityDebugger.previousState",
      () => {
        this.navigateToPreviousState();
      }
    );

    // Command to navigate to next state snapshot
    const nextStateCommand = vscode.commands.registerCommand(
      "solidityDebugger.nextState",
      () => {
        this.navigateToNextState();
      }
    );

    // Command to navigate to a specific state snapshot
    const gotoStateCommand = vscode.commands.registerCommand(
      "solidityDebugger.gotoState",
      (snapshotId: number) => {
        this.navigateToState(snapshotId);
      }
    );

    // Command to reset state visualization
    const resetStateCommand = vscode.commands.registerCommand(
      "solidityDebugger.resetStateVisualizer",
      () => {
        this.resetState();
      }
    );

    // Command to analyze a deployed contract
    const analyzeDeployedCommand = vscode.commands.registerCommand(
      "solidityDebugger.analyzeDeployedContract",
      async () => {
        await this.analyzeDeployedContract();
      }
    );

    // Command to analyze a specific transaction
    const analyzeTransactionCommand = vscode.commands.registerCommand(
      "solidityDebugger.analyzeTransaction",
      async () => {
        await this.analyzeTransaction();
      }
    );

    // Command to inject test data (only for development/testing)
    const injectTestDataCommand = vscode.commands.registerCommand(
      "solidityDebugger.injectTestData",
      () => {
        this.injectTestData();
      }
    );

    // New command to simulate a contract function
    const simulateFunctionCommand = vscode.commands.registerCommand(
      "solidityDebugger.simulateContractFunction",
      (functionName: string, inputs: any[]) => {
        return this.simulateContractFunction(functionName, inputs);
      }
    );

    this.disposables.push(
      analyzeStateCommand,
      prevStateCommand,
      nextStateCommand,
      gotoStateCommand,
      resetStateCommand,
      analyzeDeployedCommand,
      analyzeTransactionCommand,
      injectTestDataCommand,
      simulateFunctionCommand
    );
  }

  /**
   * Analyzes the current smart contract state
   * This is the main function called from the UI
   */
  public async analyzeContractState() {
    vscode.window.showInformationMessage("Analyzing contract state...");

    // Get the active Solidity file
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== "solidity") {
      vscode.window.showErrorMessage("No Solidity file is currently active");
      return;
    }

    // First step is to analyze the contract structure from source code
    const success = await this.stateCollector.analyzeActiveContract();

    if (!success) {
      // If source analysis failed, give user options
      const choice = await vscode.window.showErrorMessage(
        "Failed to analyze contract structure. How would you like to proceed?",
        "Use test data",
        "Analyze deployed contract",
        "Cancel"
      );

      if (choice === "Use test data") {
        this.injectTestData();
      } else if (choice === "Analyze deployed contract") {
        await this.analyzeDeployedContract();
      } else {
        return; // User cancelled
      }
    } else {
      // Source analysis succeeded, determine next steps
      const choice = await vscode.window.showInformationMessage(
        "Contract structure analyzed. What would you like to do next?",
        "Analyze deployed instance",
        "Analyze transaction",
        "View structure only"
      );

      if (choice === "Analyze deployed instance") {
        await this.analyzeDeployedContract();
      } else if (choice === "Analyze transaction") {
        await this.analyzeTransaction();
      }
      // For "View structure only", we don't need to do anything else
    }

    // Open the state visualizer panel
    vscode.commands.executeCommand("solidityDebugger.showStateVisualizer");
  }

  /**
   * Analyze a deployed contract instance
   */
  private async analyzeDeployedContract() {
    const address = await vscode.window.showInputBox({
      prompt: "Enter the deployed contract address",
      placeHolder: "0x...",
      validateInput: (value) => {
        // Simple validation for Ethereum address format
        if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
          return "Please enter a valid Ethereum address (0x followed by 40 hex characters)";
        }
        return null;
      },
    });

    if (!address) {
      vscode.window.showInformationMessage("Contract analysis cancelled");
      return;
    }

    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Analyzing contract at ${address}`,
        cancellable: false,
      },
      async () => {
        const success = await this.stateCollector.analyzeDeployedContract(
          address
        );

        if (success) {
          vscode.window.showInformationMessage(
            `Successfully analyzed contract at ${address}`
          );
        } else {
          vscode.window.showErrorMessage(
            `Failed to analyze contract at ${address}`
          );
        }
      }
    );
  }

  /**
   * Analyze a specific transaction
   */
  private async analyzeTransaction() {
    const txHash = await vscode.window.showInputBox({
      prompt: "Enter transaction hash to analyze",
      placeHolder: "0x...",
      validateInput: (value) => {
        // Simple validation for transaction hash format
        if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
          return "Please enter a valid transaction hash (0x followed by 64 hex characters)";
        }
        return null;
      },
    });

    if (!txHash) {
      vscode.window.showInformationMessage("Transaction analysis cancelled");
      return;
    }

    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Analyzing transaction ${txHash}`,
        cancellable: false,
      },
      async () => {
        const success = await this.stateCollector.analyzeTransaction(txHash);

        if (success) {
          vscode.window.showInformationMessage(
            `Successfully analyzed transaction ${txHash}`
          );
        } else {
          vscode.window.showErrorMessage(
            `Failed to analyze transaction ${txHash}`
          );
        }
      }
    );
  }

  /**
   * Simulate execution of a contract function
   */
  public simulateContractFunction(
    functionName: string,
    inputs: any[],
    currentState?: Record<string, any>
  ) {
    // If no current state is provided, use the built state
    const state = currentState || this.buildCurrentState();

    // Use the contract simulator to simulate the function execution
    return this.contractSimulator.simulateFunction(functionName, inputs, state);
  }

  /**
   * Get the current available contract state snapshots
   */
  public getSnapshots(): StateSnapshot[] {
    return this.stateCollector.getSnapshots();
  }

  /**
   * Get the current contract ABI
   */
  public getCurrentContractAbi(): any[] {
    return this.stateCollector.getCurrentContractAbi();
  }

  /**
   * Get the current contract name
   */
  public getCurrentContractName(): string {
    return this.stateCollector.getCurrentContractName();
  }

  /**
   * Get the storage layout variables
   */
  public getStorageVariables(): any[] {
    return this.stateCollector.getStorageVariables();
  }

  /**
   * Get the current contract state
   */
  public getCurrentState(): Record<string, any> {
    return this.stateCollector.getCurrentState();
  }

  /**
   * Navigate to the previous state snapshot
   */
  private navigateToPreviousState() {
    if (this.currentSnapshotId > 0) {
      this.navigateToState(this.currentSnapshotId - 1);
    }
  }

  /**
   * Navigate to the next state snapshot
   */
  private navigateToNextState() {
    const snapshots = this.stateCollector.getSnapshots();
    if (this.currentSnapshotId < snapshots.length - 1) {
      this.navigateToState(this.currentSnapshotId + 1);
    }
  }

  /**
   * Navigate to a specific state snapshot
   */
  private navigateToState(snapshotId: number) {
    const snapshots = this.stateCollector.getSnapshots();
    if (snapshotId >= 0 && snapshotId < snapshots.length) {
      this.currentSnapshotId = snapshotId;
      this.notifyStateUpdate();
    }
  }

  /**
   * Reset state to initial conditions
   */
  private resetState() {
    this.stateCollector.clearState();
    this.currentSnapshotId = -1;
    this.notifyStateUpdate();
  }

  /**
   * Transform raw state changes into a structured contract state object
   */
  private buildCurrentState(): Record<string, any> {
    const snapshots = this.stateCollector.getSnapshots();
    if (snapshots.length === 0 || this.currentSnapshotId < 0) {
      return {};
    }

    // Build state up to the current snapshot
    const stateByVariable: Record<string, any> = {};

    // Process all snapshots up to the current one
    for (let i = 0; i <= this.currentSnapshotId; i++) {
      const snapshot = snapshots[i];

      for (const change of snapshot.changes) {
        const key = change.variableName || `slot_${change.slot}`;

        // Create a friendly representation of the value
        const friendlyValue = this.formatValueForDisplay(
          change.newValue,
          change.typeInfo
        );

        stateByVariable[key] = {
          type: change.typeInfo || "unknown",
          value: change.newValue,
          displayValue: friendlyValue,
          previousValue: change.oldValue,
          lastChanged: snapshot.id,
          slot: change.slot,
          operation: change.operation,
        };
      }
    }

    return stateByVariable;
  }

  /**
   * Format a value for display based on its type
   */
  private formatValueForDisplay(value: string, typeInfo?: string): string {
    if (!value) return "null";

    // Remove 0x prefix for processing
    const rawValue = value.startsWith("0x") ? value.slice(2) : value;

    // Convert based on inferred/known type
    if (typeInfo) {
      if (typeInfo.includes("Boolean")) {
        // For boolean values
        return rawValue === "0" ? "false" : "true";
      }

      if (typeInfo.includes("Address")) {
        // For Ethereum addresses - keep 0x prefix
        return value.toLowerCase();
      }

      if (typeInfo.includes("Number")) {
        // For number types, convert to decimal
        try {
          // Convert hex to decimal
          const decimal = BigInt(`0x${rawValue}`).toString(10);
          return decimal;
        } catch (e) {
          return value; // Return original if conversion fails
        }
      }
    }

    // For unknown types with common patterns
    if (rawValue === "0") return "0";
    if (rawValue === "1") return "1";

    // If it looks like an address (20 bytes)
    if (rawValue.length === 40) {
      return `0x${rawValue.toLowerCase()}`;
    }

    // Default case: return the original value
    return value;
  }

  /**
   * Notify UI components about state updates
   */
  private notifyStateUpdate() {
    const currentState = this.buildCurrentState();
    const snapshots = this.stateCollector.getSnapshots();

    this.stateUpdateEmitter.fire({
      currentState,
      history: snapshots,
      currentStep: this.currentSnapshotId,
    });
  }

  /**
   * Inject test data for development and testing
   */
  private injectTestData() {
    vscode.window.showInformationMessage(
      "Using synthetic test data for visualization"
    );

    const testTraceData = {
      hash: "0x123456789abcdef",
      to: "0xContractAddress",
      structLogs: [
        {
          pc: 100,
          op: "SSTORE",
          stack: ["0x0", "0x5"], // slot 0, value 5
          depth: 1,
          gas: 100000,
        },
        {
          pc: 105,
          op: "SSTORE",
          stack: ["0x1", "0xa"], // slot 1, value 10
          depth: 1,
          gas: 95000,
        },
        {
          pc: 110,
          op: "SLOAD",
          stack: ["0x0"],
          depth: 1,
          gas: 90000,
        },
        {
          pc: 120,
          op: "SSTORE",
          stack: ["0x0", "0x7"], // slot 0, value 7 (update)
          depth: 1,
          gas: 85000,
        },
      ],
    };

    // Process the test data
    this.stateCollector.processTraceData(testTraceData);

    // Simulate a second transaction
    const secondTraceData = {
      hash: "0x987654321abcdef",
      to: "0xContractAddress",
      structLogs: [
        {
          pc: 200,
          op: "SSTORE",
          stack: ["0x2", "0x14"], // slot 2, value 20
          depth: 1,
          gas: 100000,
        },
        {
          pc: 210,
          op: "SSTORE",
          stack: ["0x1", "0xf"], // slot 1, value 15 (update)
          depth: 1,
          gas: 95000,
        },
      ],
    };

    this.stateCollector.processTraceData(secondTraceData);

    // Set up mock ABI for the simulator
    const mockAbi = [
      {
        type: "function",
        name: "transfer",
        inputs: [
          { name: "to", type: "address" },
          { name: "amount", type: "uint256" },
        ],
        outputs: [{ name: "", type: "bool" }],
        stateMutability: "nonpayable",
      },
      {
        type: "function",
        name: "balanceOf",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
      },
      {
        type: "function",
        name: "mint",
        inputs: [{ name: "amount", type: "uint256" }],
        outputs: [],
        stateMutability: "nonpayable",
      },
    ];

    this.contractSimulator.setContractAbi(mockAbi);

    // Notify UI about the state update
    this.notifyStateUpdate();

    // Fire contract analyzed event with mock data
    this.contractAnalyzedEmitter.fire({
      contractName: "MockToken",
      abi: mockAbi,
      storageLayout: {
        storage: [
          { slot: "0", label: "totalSupply", type: "uint256", offset: 0 },
          { slot: "1", label: "initialized", type: "bool", offset: 0 },
          { slot: "2", label: "decimals", type: "uint8", offset: 0 },
        ],
      },
    });
  }

  /**
   * Clean up resources when the extension is deactivated
   */
  public dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}

/**
 * Initializes all services for the extension
 */
export function initializeServices(context: vscode.ExtensionContext) {
  console.log("Initializing services...");

  // Initialize state processor service
  const stateProcessorService = new StateProcessorService(context);
  context.subscriptions.push(stateProcessorService);

  // Initialize other services
  const gasAnalyzerService = new GasAnalyzerService();
  context.subscriptions.push(gasAnalyzerService);

  const educationalContentService = new EducationalContentService();
  context.subscriptions.push(educationalContentService);

  return {
    stateProcessorService,
    gasAnalyzerService,
    educationalContentService,
  };
}

// Other service classes remain the same as in your original code
// GasAnalyzerService and EducationalContentService

export class GasAnalyzerService implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.registerCommands();
    console.log("GasAnalyzerService initialized");
  }

  private registerCommands() {
    const analyzeGasCommand = vscode.commands.registerCommand(
      "solidityDebugger.analyzeGasUsage",
      () => {
        this.analyzeGasUsage();
      }
    );

    this.disposables.push(analyzeGasCommand);
  }

  public analyzeGasUsage() {
    vscode.window.showInformationMessage("Analyzing gas usage...");
    // Implementation for gas analysis would go here
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}

export class EducationalContentService implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.registerCommands();
    console.log("EducationalContentService initialized");
  }

  private registerCommands() {
    const showTutorialCommand = vscode.commands.registerCommand(
      "solidityDebugger.showSmartContractTutorial",
      () => {
        this.showTutorial();
      }
    );

    this.disposables.push(showTutorialCommand);
  }

  public showTutorial() {
    vscode.window.showInformationMessage("Opening smart contract tutorial...");
    // Implementation for showing tutorials would go here
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}

// This method is called when your extension is deactivated
export function deactivate() {
  // Clean up resources
}
