import * as vscode from "vscode";
import { SolidityDebuggerProvider } from "./debugAdapter/debuggerProxy";
import { StateVisualizerPanel } from "./webviews/panels/statePanel";
import { GasAnalyzerPanel } from "./webviews/panels/gasPanel";
import { HelpPanel } from "./webviews/panels/helpPanel";

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
export class StateProcessorService implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];

  constructor() {
    // Initialize any event listeners or commands here
    this.registerCommands();
    console.log("StateProcessorService initialized");
  }

  private registerCommands() {
    // Register any commands this service will handle
    const analyzeStateCommand = vscode.commands.registerCommand(
      "solidityDebugger.analyzeContractState",
      () => {
        this.analyzeContractState();
      }
    );

    this.disposables.push(analyzeStateCommand);
  }

  /**
   * Analyzes the current smart contract state
   */
  public analyzeContractState() {
    vscode.window.showInformationMessage("Analyzing contract state...");
    // Implementation for state analysis would go here
  }

  public dispose() {
    // Clean up any resources when the extension is deactivated
    this.disposables.forEach((d) => d.dispose());
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
  const stateProcessorService = new StateProcessorService();
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
