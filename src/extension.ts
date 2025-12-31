import * as vscode from "vscode"
import { SolidityDebuggerProvider } from "./core/debugAdapter/debuggerProxy"
import { StateVisualizerPanel } from "./webviews/panels/statePanel"
import { GasAnalyzerPanel } from "./webviews/panels/gasPanel"
import { HelpPanel } from "./webviews/panels/helpPanel"
import { StateCollector, type StateSnapshot, ErrorHandler } from "./core/stateProcessor/stateCollector"
import { ContractSimulator } from "./core/stateProcessor/contractSimulator"
import { ValidationService } from "./utils/validation"
import { Compiler } from "./core/utils/compiler"
import { GasEstimator } from "./core/gasAnalyzer/gasEstimator"
import { GasSourceMapper } from "./core/gasAnalyzer/gasSourceMapper"
import { GasTourProvider } from "./core/gasAnalyzer/gasTourProvider"
import { GasDecorationManager } from "./core/gasAnalyzer/gasDecorationManager"

// Global reference to the state processor service
let stateProcessorService: StateProcessorService | undefined
let gasAnalyzerService: GasAnalyzerService | undefined

export function activate(context: vscode.ExtensionContext) {
  console.log("Solidity Debugger extension is now active")

  // Register the debug adapter provider
  const provider = new SolidityDebuggerProvider(context)
  context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory("solidityDebug", provider))

  // Initialize core services
  const services = initializeServices(context)
  stateProcessorService = services.stateProcessorService
  gasAnalyzerService = services.gasAnalyzerService

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("solidityDebugger.showStateVisualizer", () => {
      StateVisualizerPanel.createOrShow(context.extensionUri, stateProcessorService)
    }),
    vscode.commands.registerCommand("solidityDebugger.showGasAnalyzer", () => {
      GasAnalyzerPanel.createOrShow(context.extensionUri, gasAnalyzerService)
    }),
    vscode.commands.registerCommand("solidityDebugger.showHelp", () => {
      HelpPanel.createOrShow(context.extensionUri)
    }),
  )
}

/**
 * Service for processing and visualizing smart contract state information
 */
export class StateProcessorService implements vscode.Disposable {
  private disposables: vscode.Disposable[] = []
  private stateCollector: StateCollector
  private contractSimulator: ContractSimulator
  private currentSnapshotId = -1
  private validationService = new ValidationService()
  private errorHandler = new ErrorHandler()
  private gasAnalyzerService?: GasAnalyzerService

  // Event emitters for UI updates
  private stateUpdateEmitter = new vscode.EventEmitter<{
    currentState: Record<string, any>
    history: StateSnapshot[]
    currentStep: number
  }>()

  private contractAnalyzedEmitter = new vscode.EventEmitter<{
    contractName: string
    abi: any[]
    storageLayout: any
  }>()

  private errorEmitter = new vscode.EventEmitter<{
    code: string
    message: string
    details?: string
  }>()

  public readonly onStateUpdated = this.stateUpdateEmitter.event
  public readonly onContractAnalyzed = this.contractAnalyzedEmitter.event
  public readonly onError = this.errorEmitter.event

  constructor(context: vscode.ExtensionContext) {
    try {
      this.stateCollector = new StateCollector(context)
      this.contractSimulator = new ContractSimulator(this.stateCollector)
      this.registerEventListeners()
      this.registerCommands()
      console.log(" StateProcessorService initialized successfully")
    } catch (error) {
      const message = `Failed to initialize StateProcessorService: ${error instanceof Error ? error.message : String(error)}`
      this.errorHandler.handleInitializationError(message)
      throw error
    }
  }

  public setGasAnalyzerService(service: GasAnalyzerService) {
      this.gasAnalyzerService = service;
  }

  private registerEventListeners() {
    try {
      this.disposables.push(
        this.stateCollector.onSnapshotCreated((snapshot) => {
          this.currentSnapshotId = snapshot.id
          this.notifyStateUpdate()
        }),
      )

      this.disposables.push(
        this.stateCollector.onContractAnalyzed((contractInfo) => {
          this.contractSimulator.setContractAbi(contractInfo.abi)
          this.contractAnalyzedEmitter.fire(contractInfo)
        }),
      )

      this.disposables.push(
        this.stateCollector.onError((error) => {
          this.errorEmitter.fire(error)
        }),
      )
    } catch (error) {
      this.errorHandler.log(`Error registering event listeners: ${error}`)
    }
  }

  /**
   * Register commands for interacting with the state processor
   */
  private registerCommands() {
    // Command to analyze current contract state
    const analyzeStateCommand = vscode.commands.registerCommand("solidityDebugger.analyzeContractState", () => {
      this.analyzeContractState()
    })

    // Command to navigate to previous state snapshot
    const prevStateCommand = vscode.commands.registerCommand("solidityDebugger.previousState", () => {
      this.navigateToPreviousState()
    })

    // Command to navigate to next state snapshot
    const nextStateCommand = vscode.commands.registerCommand("solidityDebugger.nextState", () => {
      this.navigateToNextState()
    })

    // Command to navigate to a specific state snapshot
    const gotoStateCommand = vscode.commands.registerCommand("solidityDebugger.gotoState", (snapshotId: number) => {
      this.navigateToState(snapshotId)
    })

    // Command to reset state visualization
    const resetStateCommand = vscode.commands.registerCommand("solidityDebugger.resetStateVisualizer", () => {
      this.resetState()
    })

    // Command to analyze a deployed contract
    const analyzeDeployedCommand = vscode.commands.registerCommand(
      "solidityDebugger.analyzeDeployedContract",
      async () => {
        await this.analyzeDeployedContract()
      },
    )

    // Command to analyze a specific transaction
    const analyzeTransactionCommand = vscode.commands.registerCommand(
      "solidityDebugger.analyzeTransaction",
      async () => {
        await this.analyzeTransaction()
      },
    )

    // Command to inject test data (only for development/testing)
    const injectTestDataCommand = vscode.commands.registerCommand("solidityDebugger.injectTestData", () => {
      this.injectTestData()
    })

    // New command to simulate a contract function
    const simulateFunctionCommand = vscode.commands.registerCommand(
      "solidityDebugger.simulateContractFunction",
      (functionName: string, inputs: any[]) => {
        return this.simulateContractFunction(functionName, inputs)
      },
    )

    this.disposables.push(
      analyzeStateCommand,
      prevStateCommand,
      nextStateCommand,
      gotoStateCommand,
      resetStateCommand,
      analyzeDeployedCommand,
      analyzeTransactionCommand,
      injectTestDataCommand,
      simulateFunctionCommand,
    )
  }

  public async analyzeContractState() {
    try {
      const editor = vscode.window.activeTextEditor
      if (!editor || editor.document.languageId !== "solidity") {
        this.errorEmitter.fire({
          code: "NO_SOLIDITY_FILE",
          message: "No Solidity file is currently active",
        })
        vscode.window.showErrorMessage("No Solidity file is currently active")
        return
      }

      vscode.window.showInformationMessage("Analyzing contract state...")

      const success = await this.stateCollector.analyzeActiveContract()

      if (!success) {
        const choice = await vscode.window.showErrorMessage(
          "Failed to analyze contract structure. How would you like to proceed?",
          "Use test data",
          "Analyze deployed contract",
          "Cancel",
        )

        if (choice === "Use test data") {
          this.injectTestData()
        } else if (choice === "Analyze deployed contract") {
          await this.analyzeDeployedContract()
        }
        return
      }

      const choice = await vscode.window.showInformationMessage(
        "Contract structure analyzed. What would you like to do next?",
        "Analyze deployed instance",
        "Analyze transaction",
        "View structure only",
      )

      if (choice === "Analyze deployed instance") {
        await this.analyzeDeployedContract()
      } else if (choice === "Analyze transaction") {
        await this.analyzeTransaction()
      }

      vscode.commands.executeCommand("solidityDebugger.showStateVisualizer")
    } catch (error) {
      const message = `Error analyzing contract: ${error instanceof Error ? error.message : String(error)}`
      this.errorHandler.handleError("ANALYSIS_ERROR", message)
      this.errorEmitter.fire({
        code: "ANALYSIS_ERROR",
        message,
      })
      vscode.window.showErrorMessage(message)
    }
  }

  private async analyzeDeployedContract() {
    try {
      const address = await vscode.window.showInputBox({
        prompt: "Enter the deployed contract address",
        placeHolder: "0x...",
        validateInput: (value) => {
          const validation = this.validationService.validateEthereumAddress(value)
          return validation.valid ? null : validation.error
        },
      })

      if (!address) {
        vscode.window.showInformationMessage("Contract analysis cancelled")
        return
      }

      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Analyzing contract at ${address}`,
          cancellable: false,
        },
        async () => {
          try {
            const success = await this.stateCollector.analyzeDeployedContract(address)

            if (success) {
              vscode.window.showInformationMessage(`Successfully analyzed contract at ${address}`)
            } else {
              throw new Error(`Failed to analyze contract at ${address}`)
            }
          } catch (error) {
            const message = `Error analyzing deployed contract: ${error instanceof Error ? error.message : String(error)}`
            this.errorEmitter.fire({
              code: "DEPLOYED_CONTRACT_ERROR",
              message,
            })
            vscode.window.showErrorMessage(message)
          }
        },
      )
    } catch (error) {
      const message = `Error in analyzeDeployedContract: ${error instanceof Error ? error.message : String(error)}`
      this.errorHandler.handleError("DEPLOYED_CONTRACT_ERROR", message)
    }
  }

  private async analyzeTransaction() {
    try {
      const txHash = await vscode.window.showInputBox({
        prompt: "Enter transaction hash to analyze",
        placeHolder: "0x...",
        validateInput: (value) => {
          const validation = this.validationService.validateTransactionHash(value)
          return validation.valid ? null : validation.error
        },
      })

      if (!txHash) {
        vscode.window.showInformationMessage("Transaction analysis cancelled")
        return
      }

      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Analyzing transaction ${txHash}`,
          cancellable: false,
        },
        async () => {
          try {
            const success = await this.stateCollector.analyzeTransaction(txHash)

            if (success) {
              vscode.window.showInformationMessage(`Successfully analyzed transaction ${txHash}`)
            } else {
              throw new Error(`Failed to analyze transaction ${txHash}`)
            }
          } catch (error) {
            const message = `Error analyzing transaction: ${error instanceof Error ? error.message : String(error)}`
            this.errorEmitter.fire({
              code: "TRANSACTION_ERROR",
              message,
            })
            vscode.window.showErrorMessage(message)
          }
        },
      )
    } catch (error) {
      const message = `Error in analyzeTransaction: ${error instanceof Error ? error.message : String(error)}`
      this.errorHandler.handleError("TRANSACTION_ERROR", message)
    }
  }

  /**
   * Simulate execution of a contract function
   */
  public async simulateContractFunction(functionName: string, inputs: any[], currentState?: Record<string, any>) {
    try {
      const state = currentState || this.buildCurrentState()
      const result = await this.contractSimulator.simulateFunction(functionName, inputs, state)
      
      // Forward trace to GasAnalyzer if available
      if (result.trace && this.gasAnalyzerService) {
          this.gasAnalyzerService.reportRuntimeTrace(result.trace, functionName);
      }
      
      return result
    } catch (error) {
      const message = `Error simulating function: ${error instanceof Error ? error.message : String(error)}`
      this.errorHandler.handleError("SIMULATION_ERROR", message)
      this.errorEmitter.fire({
        code: "SIMULATION_ERROR",
        message,
      })
      return { stateChanges: [], newState: currentState || {} }
    }
  }

  /**
   * Get the current available contract state snapshots
   */
  public getSnapshots(): StateSnapshot[] {
    return this.stateCollector.getSnapshots()
  }

  /**
   * Get the current contract ABI
   */
  public getCurrentContractAbi(): any[] {
    return this.stateCollector.getCurrentContractAbi()
  }

  /**
   * Get the current contract name
   */
  public getCurrentContractName(): string {
    return this.stateCollector.getCurrentContractName()
  }

  /**
   * Get the storage layout variables
   */
  public getStorageVariables(): any[] {
    return this.stateCollector.getStorageVariables()
  }

  /**
   * Get the current contract state
   */
  public getCurrentState(): Record<string, any> {
    return this.stateCollector.getCurrentState()
  }

  /**
   * Navigate to the previous state snapshot
   */
  public navigateToPreviousState() {
    if (this.currentSnapshotId > 0) {
      this.navigateToState(this.currentSnapshotId - 1)
    }
  }

  /**
   * Navigate to the next state snapshot
   */
  public navigateToNextState() {
    const snapshots = this.stateCollector.getSnapshots()
    if (this.currentSnapshotId < snapshots.length - 1) {
      this.navigateToState(this.currentSnapshotId + 1)
    }
  }

  /**
   * Navigate to a specific state snapshot
   */
  public navigateToState(snapshotId: number) {
    const snapshots = this.stateCollector.getSnapshots()
    if (snapshotId >= 0 && snapshotId < snapshots.length) {
      this.currentSnapshotId = snapshotId
      this.notifyStateUpdate()
    }
  }

  /**
   * Reset state to initial conditions
   */
  public resetState() {
    this.stateCollector.clearState()
    this.currentSnapshotId = -1
    this.notifyStateUpdate()
  }

  /**
   * Transform raw state changes into a structured contract state object
   */
  private buildCurrentState(): Record<string, any> {
    const snapshots = this.stateCollector.getSnapshots()
    if (snapshots.length === 0 || this.currentSnapshotId < 0) {
      return {}
    }

    const stateByVariable: Record<string, any> = {}

    for (let i = 0; i <= this.currentSnapshotId; i++) {
      const snapshot = snapshots[i]

      for (const change of snapshot.changes) {
        const key = change.variableName || `slot_${change.slot}`

        const friendlyValue = this.formatValueForDisplay(change.newValue, change.typeInfo)

        stateByVariable[key] = {
          type: change.typeInfo || "unknown",
          value: change.newValue,
          displayValue: friendlyValue,
          previousValue: change.oldValue,
          lastChanged: snapshot.id,
          slot: change.slot,
          operation: change.operation,
        }
      }
    }

    return stateByVariable
  }

  /**
   * Format a value for display based on its type
   */
  private formatValueForDisplay(value: string, typeInfo?: string): string {
    if (!value) return "null"

    const rawValue = value.startsWith("0x") ? value.slice(2) : value

    if (typeInfo) {
      if (typeInfo.includes("Boolean")) {
        return rawValue === "0" ? "false" : "true"
      }

      if (typeInfo.includes("Address")) {
        return value.toLowerCase()
      }

      if (typeInfo.includes("Number")) {
        try {
          const decimal = BigInt(`0x${rawValue}`).toString(10)
          return decimal
        } catch (e) {
          return value
        }
      }
    }

    if (rawValue === "0") return "0"
    if (rawValue === "1") return "1"

    if (rawValue.length === 40) {
      return `0x${rawValue.toLowerCase()}`
    }

    return value
  }

  /**
   * Notify UI components about state updates
   */
  private notifyStateUpdate() {
    const currentState = this.buildCurrentState()
    const snapshots = this.stateCollector.getSnapshots()

    this.stateUpdateEmitter.fire({
      currentState,
      history: snapshots,
      currentStep: this.currentSnapshotId,
    })
  }

  /**
   * Inject test data for development and testing
   */
  private injectTestData() {
    try {
      vscode.window.showInformationMessage("Using synthetic test data for visualization")

      const testTraceData = {
        hash: "0x123456789abcdef",
        to: "0xContractAddress",
        structLogs: [
          {
            pc: 100,
            op: "SSTORE",
            stack: ["0x0", "0x5"],
            depth: 1,
            gas: 100000,
          },
          {
            pc: 105,
            op: "SSTORE",
            stack: ["0x1", "0xa"],
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
            stack: ["0x0", "0x7"],
            depth: 1,
            gas: 85000,
          },
        ],
      }

      this.stateCollector.processTraceData(testTraceData)

      const secondTraceData = {
        hash: "0x987654321abcdef",
        to: "0xContractAddress",
        structLogs: [
          {
            pc: 200,
            op: "SSTORE",
            stack: ["0x2", "0x14"],
            depth: 1,
            gas: 100000,
          },
          {
            pc: 210,
            op: "SSTORE",
            stack: ["0x1", "0xf"],
            depth: 1,
            gas: 95000,
          },
        ],
      }

      this.stateCollector.processTraceData(secondTraceData)

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
      ]

      this.contractSimulator.setContractAbi(mockAbi)

      this.notifyStateUpdate()

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
      })
    } catch (error) {
      const message = `Error injecting test data: ${error instanceof Error ? error.message : String(error)}`
      this.errorHandler.handleError("TEST_DATA_ERROR", message)
    }
  }

  /**
   * Clean up resources when the extension is deactivated
   */
  public dispose() {
    this.disposables.forEach((d) => d.dispose())
  }
}

/**
 * Service for analyzing gas usage and optimization
 */
export class GasAnalyzerService implements vscode.Disposable {
  private disposables: vscode.Disposable[] = []
  private gasEstimator: GasEstimator = new GasEstimator()
  private gasSourceMapper: GasSourceMapper = new GasSourceMapper()
  private gasTourProvider: GasTourProvider = new GasTourProvider()
  private gasDecorationManager: GasDecorationManager = new GasDecorationManager()
  private currentContractAbi: any[] = []
  private errorHandler = new ErrorHandler()

  private gasAnalysisEmitter = new vscode.EventEmitter<
    {
      functionName: string
      gasUsed: number
      recommendations: string[]
    }[]
  >()

  public readonly onGasAnalysisComplete = this.gasAnalysisEmitter.event

  constructor() {
    try {
      this.gasEstimator = new GasEstimator()
      this.registerCommands()
      console.log(" GasAnalyzerService initialized successfully")
    } catch (error) {
      const message = `Failed to initialize GasAnalyzerService: ${error instanceof Error ? error.message : String(error)}`
      this.errorHandler.handleInitializationError(message)
    }
  }

  private registerCommands() {
    const analyzeGasCommand = vscode.commands.registerCommand("solidityDebugger.analyzeGasUsage", () => {
      this.analyzeGasUsage()
    })

    const startGasTourCommand = vscode.commands.registerCommand("solidityDebugger.startGasTour", () => {
      this.startGasTour()
    })

    const nextHotspotCommand = vscode.commands.registerCommand("solidityDebugger.nextGasHotspot", () => {
      const editor = vscode.window.activeTextEditor
      if (editor) {
        this.gasTourProvider.nextHotspot(editor)
      }
    })

    const prevHotspotCommand = vscode.commands.registerCommand("solidityDebugger.previousGasHotspot", () => {
      const editor = vscode.window.activeTextEditor
      if (editor) {
        this.gasTourProvider.previousHotspot(editor)
      }
    })

    const finishTourCommand = vscode.commands.registerCommand("solidityDebugger.finishGasTour", () => {
      this.finishGasTour()
    })

    this.disposables.push(
      analyzeGasCommand,
      startGasTourCommand,
      nextHotspotCommand,
      prevHotspotCommand,
      finishTourCommand
    )
  }

  public async analyzeGasUsage() {
    try {
      const editor = vscode.window.activeTextEditor
      if (!editor || editor.document.languageId !== "solidity") {
        vscode.window.showErrorMessage("No Solidity file is currently active")
        return
      }

      vscode.window.showInformationMessage("Analyzing gas usage...")

      const contractCode = editor.document.getText()
      const filePath = editor.document.uri.fsPath

      // 1. Compile to get bytecode
      const compilationOutput = await Compiler.compile(contractCode, filePath);
      const contractData = Compiler.getContractFromOutput(compilationOutput, filePath);

      if (!contractData || !contractData.bytecode) {
          throw new Error("Could not compile contract to retrieve bytecode");
      }
      
      // 2. Analyze Bytecode via GasEstimator
      this.gasEstimator.processTrace(contractData.bytecode, contractData.contractName);
      
      const usageData = this.gasEstimator.getGasUsageForFunction(contractData.contractName);
      
      const results = [];
      if (usageData) {
          results.push(usageData);
      }

      // 3. Fallback/Complementary: Regex for individual function names (still useful for listing them)
      // We can attribute a portion of the gas or just listed them with "Dynamic Analysis Required" recommendations
      const functionPattern = /function\s+(\w+)\s*$$[^)]*$$/g
      let match
      while ((match = functionPattern.exec(contractCode)) !== null) {
        const functionName = match[1]
        // Don't duplicate if same name (unlikely for contract name vs function name)
        if (functionName !== contractData.contractName) {
            results.push({
                functionName,
                gasUsed: 0, // 0 indicates unknown/requires dynamic
                recommendations: ["Run contract interaction to get precise gas", "Static analysis unavailable for specific function subset"]
            })
        }
      }

      this.gasAnalysisEmitter.fire(results)

      vscode.window.showInformationMessage(`Analyzed contract ${contractData.contractName}`)
    } catch (error) {
      const message = `Error analyzing gas: ${error instanceof Error ? error.message : String(error)}`
      this.errorHandler.handleError("GAS_ANALYSIS_ERROR", message)
      vscode.window.showErrorMessage(message)
    }
  }

  public setCurrentContractAbi(abi: any[]) {
    this.currentContractAbi = abi
  }

  public reportRuntimeTrace(trace: any, functionName: string) {
      if (this.gasEstimator) {
          this.gasEstimator.processTransactionTrace(trace, functionName);
      }
  }

  /**
   * Start interactive gas optimization tour
   */
  private async startGasTour() {
    try {
      const editor = vscode.window.activeTextEditor
      if (!editor || editor.document.languageId !== "solidity") {
        vscode.window.showErrorMessage("No Solidity file is currently active")
        return
      }

      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Analyzing gas usage...",
        cancellable: false
      }, async () => {
        const contractCode = editor.document.getText()
        const filePath = editor.document.uri.fsPath

        // Compile contract
        console.log("[Gas Tour] Compiling contract at:", filePath)
        const compilationOutput = await Compiler.compile(contractCode, filePath)
        console.log("[Gas Tour] Compilation output received")
        
        const contractData = Compiler.getContractFromOutput(compilationOutput, filePath)

        if (!contractData) {
          console.error("[Gas Tour] No contract data returned from compilation")
          throw new Error("Could not extract contract data from compilation output. Check console for details.")
        }

        // Extract source map and contract details early
        const fileName = Object.keys(compilationOutput.contracts)[0]
        const contractName = Object.keys(compilationOutput.contracts[fileName])[0]
        const contract = compilationOutput.contracts[fileName][contractName]

        if (!contractData.bytecode) {
          console.error("[Gas Tour] Bytecode is missing or empty")
          console.error("[Gas Tour] Contract data:", contractData)
          
          // Check if this is an abstract contract
          const isAbstract = contract.evm?.bytecode?.object === ""
          
          if (isAbstract) {
            vscode.window.showWarningMessage(
              `Cannot analyze gas for ${contractData.contractName}: This appears to be an abstract contract or library. ` +
              `Please analyze a concrete contract that can be deployed (one that inherits from ${contractData.contractName}).`,
              "Learn More"
            ).then(selection => {
              if (selection === "Learn More") {
                vscode.env.openExternal(vscode.Uri.parse(
                  "https://docs.soliditylang.org/en/latest/contracts.html#abstract-contracts"
                ))
              }
            })
            return
          }
          
          throw new Error(`Bytecode not found for contract ${contractData.contractName}. The contract may have compilation errors.`)
        }

        console.log("[Gas Tour] Bytecode length:", contractData.bytecode.length)

        // Extract source map
        const sourceMap = contract.evm?.deployedBytecode?.sourceMap || contract.evm?.bytecode?.sourceMap || ''

        console.log("[Gas Tour] Source map available:", sourceMap ? 'yes' : 'no')

        // Analyze gas usage
        const hotspots = this.gasSourceMapper.analyzeGasUsage(
          contractData.bytecode,
          sourceMap,
          contractCode
        )

        console.log("[Gas Tour] Found", hotspots.length, "gas hotspots")

        if (hotspots.length === 0) {
          vscode.window.showInformationMessage("No gas optimization opportunities found.")
          return
        }

        // Apply decorations
        this.gasDecorationManager.applyTourDecorations(editor, hotspots)

        // Start tour
        this.gasTourProvider.startTour(hotspots, editor)

        // Listen for tour events
        this.disposables.push(
          this.gasTourProvider.onStepChanged(({ current, total, hotspot }) => {
            this.gasDecorationManager.highlightCurrentHotspot(editor, hotspot)
            vscode.window.showInformationMessage(
              `Gas Optimization ${current}/${total}: ${hotspot.recommendation}`
            )
          }),
          this.gasTourProvider.onTourEnded(() => {
            // Convert to persistent diagnostics
            this.gasDecorationManager.convertToDiagnostics(editor.document, hotspots)
            this.gasDecorationManager.clearDecorations(editor)
          })
        )
      })
    } catch (error) {
      const message = `Error starting gas tour: ${error instanceof Error ? error.message : String(error)}`
      this.errorHandler.handleError("GAS_TOUR_ERROR", message)
      vscode.window.showErrorMessage(message)
    }
  }

  /**
   * Finish the gas optimization tour
   */
  private finishGasTour() {
    this.gasTourProvider.finishTour()
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose())
    this.gasEstimator.dispose()
    this.gasTourProvider.dispose()
    this.gasDecorationManager.dispose()
  }
}

/**
 * Service for providing educational content
 */
export class EducationalContentService implements vscode.Disposable {
  private disposables: vscode.Disposable[] = []

  constructor() {
    this.registerCommands()
    console.log("EducationalContentService initialized")
  }

  private registerCommands() {
    const showTutorialCommand = vscode.commands.registerCommand("solidityDebugger.showSmartContractTutorial", () => {
      this.showTutorial()
    })

    this.disposables.push(showTutorialCommand)
  }

  public showTutorial() {
    vscode.window.showInformationMessage("Opening smart contract tutorial...")
    // Implementation for showing tutorials would go here
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose())
  }
}

// This method is called when your extension is deactivated
export function deactivate() {
  console.log(" Extension deactivated")
}

/**
 * Initializes all services for the extension
 */
export function initializeServices(context: vscode.ExtensionContext) {
  console.log(" Initializing services...")

  const stateProcessorService = new StateProcessorService(context)
  context.subscriptions.push(stateProcessorService)

  const gasAnalyzerService = new GasAnalyzerService()
  context.subscriptions.push(gasAnalyzerService)
  
  // Link services
  stateProcessorService.setGasAnalyzerService(gasAnalyzerService);

  const educationalContentService = new EducationalContentService()
  context.subscriptions.push(educationalContentService)

  return {
    stateProcessorService,
    gasAnalyzerService,
    educationalContentService,
  }
}
