import * as vscode from "vscode";
import { SolidityDebuggerProvider } from "./debugAdapter/debuggerProxy";
import { StateVisualizerPanel } from "./webviews/panels/statePanel";
import { GasAnalyzerPanel } from "./webviews/panels/gasPanel";
import { HelpPanel } from "./webviews/panels/helpPanel";
import { StateCollector, StateChange, StateSnapshot } from './stateProcessor/stateCollector';

export function activate(context: vscode.ExtensionContext) {
  console.log("Solidity Debugger extension is now active");

  // Register the debug adapter provider
  const provider = new SolidityDebuggerProvider();
  context.subscriptions.push(
    vscode.debug.registerDebugAdapterDescriptorFactory(
      "solidityDebug",
      provider
    )
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "solidityDebugger.showStateVisualizer",
      () => {
        StateVisualizerPanel.createOrShow(context.extensionUri);
      }
    ),
    vscode.commands.registerCommand("solidityDebugger.showGasAnalyzer", () => {
      GasAnalyzerPanel.createOrShow(context.extensionUri);
    }),
    vscode.commands.registerCommand("solidityDebugger.showHelp", () => {
      HelpPanel.createOrShow(context.extensionUri);
    })
  );

  // Initialize core services
  initializeServices(context);
}

/**
 * Service for processing smart contract state information
 */

/**
 * Service for processing and visualizing smart contract state information
 */
export class StateProcessorService implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private stateCollector: StateCollector;
  private currentSnapshotId: number = -1;
  
  // Event emitters for UI updates
  private stateUpdateEmitter = new vscode.EventEmitter<{
    currentState: Record<string, any>;
    history: StateSnapshot[];
    currentStep: number;
  }>();
  
  public readonly onStateUpdated = this.stateUpdateEmitter.event;

  constructor(context: vscode.ExtensionContext) {
    this.stateCollector = new StateCollector(context);
    this.registerEventListeners();
    this.registerCommands();
    console.log("StateProcessorService initialized");
  }

  /**
   * Register event listeners for state change events
   */
  private registerEventListeners() {
    this.disposables.push(
      this.stateCollector.onSnapshotCreated(snapshot => {
        this.currentSnapshotId = snapshot.id;
        this.notifyStateUpdate();
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
    
    // Command to inject test data for development/testing
    const injectTestDataCommand = vscode.commands.registerCommand(
      "solidityDebugger.injectTestData",
      () => {
        this.injectTestData();
      }
    );

    this.disposables.push(
      analyzeStateCommand,
      prevStateCommand,
      nextStateCommand,
      gotoStateCommand,
      resetStateCommand,
      injectTestDataCommand
    );
  }

  /**
   * Analyzes the current smart contract state
   * This is the main function called from the UI
   */
  public analyzeContractState() {
    vscode.window.showInformationMessage("Analyzing contract state...");
    
    // Get the active Solidity file
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'solidity') {
      vscode.window.showErrorMessage("No Solidity file is currently active");
      return;
    }
    
    // In a real implementation, you would:
    // 1. Trigger a debug session or use an existing one
    // 2. Capture trace data from the debug adapter
    // 3. Process the trace data
    
    // For demo purposes, we'll inject some test data
    this.injectTestData();
    
    // Open the state visualizer panel
    vscode.commands.executeCommand("solidityDebugger.showStateVisualizer");
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
        
        stateByVariable[key] = {
          type: change.typeInfo || 'unknown',
          value: change.newValue,
          previousValue: change.oldValue,
          lastChanged: snapshot.id
        };
      }
    }
    
    return stateByVariable;
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
      currentStep: this.currentSnapshotId
    });
  }

  /**
   * Inject test data for development and testing
   */
  private injectTestData() {
    const testTraceData = {
      hash: '0x123456789abcdef',
      to: '0xContractAddress',
      structLogs: [
        {
          pc: 100,
          op: 'SSTORE',
          stack: ['0x0', '0x5'], // slot 0, value 5
          depth: 1,
          gas: 100000
        },
        {
          pc: 105,
          op: 'SSTORE',
          stack: ['0x1', '0xa'], // slot 1, value 10
          depth: 1,
          gas: 95000
        },
        {
          pc: 110,
          op: 'SLOAD',
          stack: ['0x0'],
          depth: 1,
          gas: 90000
        },
        {
          pc: 120,
          op: 'SSTORE',
          stack: ['0x0', '0x7'], // slot 0, value 7 (update)
          depth: 1,
          gas: 85000
        }
      ]
    };
    
    // Process the test data
    this.stateCollector.processTraceData(testTraceData);
    
    // Simulate a second transaction
    const secondTraceData = {
      hash: '0x987654321abcdef',
      to: '0xContractAddress',
      structLogs: [
        {
          pc: 200,
          op: 'SSTORE',
          stack: ['0x2', '0x14'], // slot 2, value 20
          depth: 1,
          gas: 100000
        },
        {
          pc: 210,
          op: 'SSTORE',
          stack: ['0x1', '0xf'], // slot 1, value 15 (update)
          depth: 1,
          gas: 95000
        }
      ]
    };
    
    this.stateCollector.processTraceData(secondTraceData);
  }

  /**
   * Clean up resources when the extension is deactivated
   */
  public dispose() {
    this.disposables.forEach(d => d.dispose());
  }
}

/**
 * Service for analyzing gas consumption in smart contracts
 */
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

  /**
   * Analyzes gas usage in the current smart contract
   */
  public analyzeGasUsage() {
    vscode.window.showInformationMessage("Analyzing gas usage...");
    // Implementation for gas analysis would go here
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}

/**
 * Service for providing educational content about smart contracts
 */
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

  /**
   * Shows a tutorial about smart contract development
   */
  public showTutorial() {
    vscode.window.showInformationMessage("Opening smart contract tutorial...");
    // Implementation for showing tutorials would go here
  }

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

  // Initialize gas analyzer service
  const gasAnalyzerService = new GasAnalyzerService();
  context.subscriptions.push(gasAnalyzerService);

  // Initialize educational content service
  const educationalContentService = new EducationalContentService();
  context.subscriptions.push(educationalContentService);
}

// This method is called when your extension is deactivated
export function deactivate() {
  // Clean up resources
}
