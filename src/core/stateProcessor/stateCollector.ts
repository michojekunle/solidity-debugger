import * as vscode from "vscode"
import * as ethers from "ethers"
import * as solc from "solc"
import * as path from "path"

/**
 * Represents a change in the smart contract state
 */
export interface StateChange {
  slot: string // Storage slot that changed
  oldValue: string // Previous value (hex string)
  newValue: string // New value (hex string)
  variableName?: string // If available, the variable name associated with this slot
  typeInfo?: string // Type information for the value (uint256, address, etc.)
  operation: string // Operation that caused this change (SSTORE, etc.)
  pc: number // Program counter at time of change
  depth: number // Call depth
  transaction?: string // Transaction hash if available
}

/**
 * Represents a snapshot of state changes in a specific transaction/call
 */
export interface StateSnapshot {
  id: number // Sequential ID of this snapshot
  timestamp: number // When this snapshot was created
  changes: StateChange[] // State changes in this snapshot
  hash?: string // Transaction hash if available
  contextInfo?: any // Additional context about this snapshot
}

/**
 * Maps ABI types to more user-friendly type descriptions
 */
const TYPE_MAPPING: Record<string, string> = {
  uint256: "Number (uint256)",
  uint128: "Number (uint128)",
  uint64: "Number (uint64)",
  uint32: "Number (uint32)",
  uint16: "Number (uint16)",
  uint8: "Number (uint8)",
  int256: "Signed Number (int256)",
  int128: "Signed Number (int128)",
  int64: "Signed Number (int64)",
  int32: "Signed Number (int32)",
  int16: "Signed Number (int16)",
  int8: "Signed Number (int8)",
  address: "Ethereum Address",
  bool: "Boolean",
  string: "Text String",
  bytes: "Byte Array",
  bytes32: "Fixed Bytes (32)",
}

/**
 * Service for collecting and analyzing smart contract state changes
 */
export class StateCollector implements vscode.Disposable {
  private snapshots: StateSnapshot[] = []
  private slotToVariableMap: Map<string, { name: string; type: string }> = new Map()
  private currentContractAbi: any[] = []
  private currentContractName = ""
  private storageLayout: any = null
  private provider: ethers.providers.JsonRpcProvider | null = null

  // Event emitters
  private snapshotCreatedEmitter = new vscode.EventEmitter<StateSnapshot>()
  private contractAnalyzedEmitter = new vscode.EventEmitter<{
    contractName: string
    abi: any[]
    storageLayout: any
  }>()

  public readonly onSnapshotCreated = this.snapshotCreatedEmitter.event
  public readonly onContractAnalyzed = this.contractAnalyzedEmitter.event

  constructor(private context: vscode.ExtensionContext) {
    // Try to connect to a local Ethereum node
    this.initializeProvider()

    // Set up Solidity compilation environment
    this.setupCompilationEnvironment()
  }

  /**
   * Initialize Ethereum provider for interacting with the blockchain
   */
  private initializeProvider() {
    try {
      // Try common development endpoints
      const endpoints = [
        "http://localhost:8545", // Ganache, Hardhat
        "http://localhost:7545", // Ganache UI default
        "http://127.0.0.1:8545", // Alternative localhost
      ]

      for (const endpoint of endpoints) {
        try {
          const provider = new ethers.providers.JsonRpcProvider(endpoint)
          // Test the connection
          provider
            .getBlockNumber()
            .then(() => {
              this.provider = provider
              console.log(`Connected to Ethereum node at ${endpoint}`)
            })
            .catch(() => {
              // Connection failed, try next endpoint
            })

          if (this.provider) break
        } catch (error) {
          // Try next endpoint
        }
      }

      if (!this.provider) {
        console.log("Could not connect to any local Ethereum node")
      }
    } catch (error) {
      console.error("Error initializing Ethereum provider:", error)
    }
  }

  /**
   * Set up the Solidity compilation environment
   */
  private setupCompilationEnvironment() {
    // This method would normally set up the proper solc-js environment
    // For VSCode extensions, you might need to bundle solc or use solc installed by the user
    console.log("Solidity compilation environment initialized")
  }

  /**
   * Clear all collected state
   */
  public clearState() {
    this.snapshots = []
    this.slotToVariableMap.clear()
  }

  /**
   * Process trace data from a transaction and extract state changes
   */
  public processTraceData(traceData: any): StateSnapshot {
    // Create a new snapshot for this transaction
    const snapshotId = this.snapshots.length
    const snapshot: StateSnapshot = {
      id: snapshotId,
      timestamp: Date.now(),
      changes: [],
      hash: traceData.hash,
      contextInfo: {
        to: traceData.to,
        from: traceData.from || "unknown",
        value: traceData.value || "0x0",
      },
    }

    // Track the slot values for this transaction
    const slotValues: Map<string, string> = new Map()

    // Process each log entry in the trace
    for (const log of traceData.structLogs) {
      // We're mainly interested in SSTORE operations which change state
      if (log.op === "SSTORE") {
        const slot = log.stack[log.stack.length - 2] // Second to last item on stack is the slot
        const value = log.stack[log.stack.length - 1] // Last item on stack is the value

        // Get the previous value for this slot
        const oldValue = slotValues.get(slot) || "0x0"

        // Only record if the value changed
        if (oldValue !== value) {
          const change: StateChange = {
            slot,
            oldValue,
            newValue: value,
            operation: log.op,
            pc: log.pc,
            depth: log.depth,
          }

          // If we have mapping information for this slot, add it
          const varInfo = this.slotToVariableMap.get(slot)
          if (varInfo) {
            change.variableName = varInfo.name
            change.typeInfo = varInfo.type
          } else {
            // Try to infer the type based on the value
            change.typeInfo = this.inferType(value)
          }

          // Add the change to the snapshot
          snapshot.changes.push(change)

          // Update our tracking of the current value
          slotValues.set(slot, value)
        }
      }
    }

    // Add the snapshot to our collection
    this.snapshots.push(snapshot)

    // Notify listeners about the new snapshot
    this.snapshotCreatedEmitter.fire(snapshot)

    return snapshot
  }

  /**
   * Add a simulated snapshot (from the contract simulator)
   */
  public addSimulatedSnapshot(snapshot: StateSnapshot): void {
    // Ensure the snapshot has a unique ID
    snapshot.id = this.snapshots.length

    // Add the snapshot to our collection
    this.snapshots.push(snapshot)

    // Notify listeners about the new snapshot
    this.snapshotCreatedEmitter.fire(snapshot)
  }

  /**
   * Process an active editor to analyze storage layout of contract
   */
  public async analyzeActiveContract() {
    const editor = vscode.window.activeTextEditor
    if (!editor || editor.document.languageId !== "solidity") {
      vscode.window.showWarningMessage("No Solidity file is currently active")
      return false
    }

    try {
      // Get the file content
      const content = editor.document.getText()
      const filePath = editor.document.uri.fsPath

      // Compile the contract to get storage layout
      const compilationResult = await this.compileSolidityContract(content, filePath)
      console.log("Compilation result:", compilationResult)
      if (!compilationResult) {
        vscode.window.showErrorMessage("Failed to compile contract")
        return false
      }

      // Process the compilation output
      this.processCompilationOutput(compilationResult)

      // Create an initial state snapshot for the contract
      this.createInitialStateSnapshot()

      // Notify listeners about the contract analysis
      this.contractAnalyzedEmitter.fire({
        contractName: this.currentContractName,
        abi: this.currentContractAbi,
        storageLayout: this.storageLayout,
      })

      return true
    } catch (error) {
      console.error("Error analyzing contract:", error)
      vscode.window.showErrorMessage(
        `Error analyzing contract: ${error instanceof Error ? error.message : String(error)}`,
      )
      return false
    }
  }

  /**
   * Create an initial state snapshot for the contract
   * This represents the contract's state after deployment
   */
  private createInitialStateSnapshot() {
    // Create a new snapshot for the initial state
    const snapshotId = this.snapshots.length
    const snapshot: StateSnapshot = {
      id: snapshotId,
      timestamp: Date.now(),
      changes: [],
      contextInfo: {
        type: "initial_state",
        contractName: this.currentContractName,
      },
    }

    // Add default values for all storage variables
    if (this.storageLayout && this.storageLayout.storage) {
      for (const item of this.storageLayout.storage) {
        const slot = "0x" + Number.parseInt(item.slot).toString(16)
        const defaultValue = this.getDefaultValueForType(item.type)

        const change: StateChange = {
          slot,
          oldValue: "0x0",
          newValue: defaultValue,
          variableName: item.label,
          typeInfo: this.mapTypeToFriendlyName(item.type),
          operation: "INITIAL",
          pc: 0,
          depth: 0,
        }

        snapshot.changes.push(change)
      }
    }

    // Add the snapshot to our collection if it has changes
    if (snapshot.changes.length > 0) {
      this.snapshots.push(snapshot)
      this.snapshotCreatedEmitter.fire(snapshot)
    }
  }

  /**
   * Get a default value for a Solidity type
   */
  private getDefaultValueForType(type: string): string {
    if (type.startsWith("uint") || type.startsWith("int")) {
      return "0x0"
    } else if (type === "bool") {
      return "0x0" // false
    } else if (type === "address") {
      return "0x0000000000000000000000000000000000000000"
    } else if (type.startsWith("bytes")) {
      return "0x0"
    } else if (type === "string") {
      return "0x0"
    } else {
      return "0x0"
    }
  }

  /**
   * Compile a Solidity contract and return the result
   */
  private async compileSolidityContract(source: string, filePath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        // Prepare input for solc
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

        // Compile
        const output = JSON.parse(solc.compile(JSON.stringify(input)))

        // Check for errors
        if (output.errors) {
          const hasError = output.errors.some((error: any) => error.severity === "error")
          if (hasError) {
            reject(new Error("Compilation failed: " + JSON.stringify(output.errors)))
            return
          }
        }

        resolve(output)
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Process the output from the Solidity compiler
   */
  private processCompilationOutput(output: any) {
    console.log("Processing compilation output:", output)
    // Find the compiled contract
    const fileName = Object.keys(output.contracts)[0]
    const contractName = Object.keys(output.contracts[fileName])[0]
    const contract = output.contracts[fileName][contractName]

    // Save contract name
    this.currentContractName = contractName

    // Save ABI for later use
    this.currentContractAbi = contract.abi

    // Process the storage layout
    this.storageLayout = contract.storageLayout

    // Map storage slots to variable names
    if (this.storageLayout && this.storageLayout.storage) {
      this.slotToVariableMap.clear()

      for (const item of this.storageLayout.storage) {
        const slot = "0x" + Number.parseInt(item.slot).toString(16)
        this.slotToVariableMap.set(slot, {
          name: item.label,
          type: this.mapTypeToFriendlyName(item.type),
        })
      }
    }
  }

  /**
   * Get the current contract ABI
   */
  public getCurrentContractAbi(): any[] {
    return this.currentContractAbi
  }

  /**
   * Get the current contract name
   */
  public getCurrentContractName(): string {
    return this.currentContractName
  }

  /**
   * Get the storage layout variables
   */
  public getStorageVariables(): any[] {
    if (!this.storageLayout || !this.storageLayout.storage) {
      return []
    }

    return this.storageLayout.storage.map((item: any) => ({
      slot: "0x" + Number.parseInt(item.slot).toString(16),
      name: item.label,
      type: this.mapTypeToFriendlyName(item.type),
      offset: item.offset || 0,
    }))
  }

  /**
   * Map a Solidity type to a more user-friendly description
   */
  private mapTypeToFriendlyName(solidityType: string): string {
    return TYPE_MAPPING[solidityType] || solidityType
  }

  /**
   * Attempt to infer the type of a value based on its format
   */
  private inferType(value: string): string {
    // Remove 0x prefix if present
    const cleanValue = value.startsWith("0x") ? value.slice(2) : value

    // Check if it's a small number (likely a bool or small uint)
    if (cleanValue === "0" || cleanValue === "1") {
      return "Boolean or Number"
    }

    // Check if it looks like an address (20 bytes)
    if (cleanValue.length === 40) {
      return "Likely Address"
    }

    // Check if it's a small number
    if (cleanValue.length <= 4) {
      return "Small Number"
    }

    // Default assumption for larger values
    return "Number or Bytes"
  }

  /**
   * Get the current available contract state snapshots
   */
  public getSnapshots(): StateSnapshot[] {
    return [...this.snapshots]
  }

  /**
   * Get the current contract state based on all snapshots
   */
  public getCurrentState(): Record<string, any> {
    const state: Record<string, any> = {}

    // Process all snapshots to build the current state
    for (const snapshot of this.snapshots) {
      for (const change of snapshot.changes) {
        const key = change.variableName || `slot_${change.slot}`

        // Create a friendly representation of the value
        const friendlyValue = this.formatValueForDisplay(change.newValue, change.typeInfo)

        state[key] = {
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

    return state
  }

  /**
   * Format a value for display based on its type
   */
  private formatValueForDisplay(value: string, typeInfo?: string): string {
    if (!value) return "null"

    // Remove 0x prefix for processing
    const rawValue = value.startsWith("0x") ? value.slice(2) : value

    // Convert based on inferred/known type
    if (typeInfo) {
      if (typeInfo.includes("Boolean")) {
        // For boolean values
        return rawValue === "0" ? "false" : "true"
      }

      if (typeInfo.includes("Address")) {
        // For Ethereum addresses - keep 0x prefix
        return value.toLowerCase()
      }

      if (typeInfo.includes("Number")) {
        // For number types, convert to decimal
        try {
          // Convert hex to decimal
          const decimal = BigInt(`0x${rawValue}`).toString(10)
          return decimal
        } catch (e) {
          return value // Return original if conversion fails
        }
      }
    }

    // For unknown types with common patterns
    if (rawValue === "0") return "0"
    if (rawValue === "1") return "1"

    // If it looks like an address (20 bytes)
    if (rawValue.length === 40) {
      return `0x${rawValue.toLowerCase()}`
    }

    // Default case: return the original value
    return value
  }

  /**
   * Fetch and analyze the runtime state of a deployed contract
   */
  public async analyzeDeployedContract(contractAddress: string) {
    if (!this.provider) {
      vscode.window.showErrorMessage("No Ethereum provider available")
      return false
    }

    try {
      // Check if the address exists
      const code = await this.provider.getCode(contractAddress)
      if (code === "0x") {
        vscode.window.showErrorMessage("No contract deployed at this address")
        return false
      }

      // Create a new snapshot for this analysis
      const snapshotId = this.snapshots.length
      const snapshot: StateSnapshot = {
        id: snapshotId,
        timestamp: Date.now(),
        changes: [],
        contextInfo: {
          type: "static_analysis",
          address: contractAddress,
        },
      }

      // Get storage values for the first few slots
      for (let i = 0; i < 10; i++) {
        const slot = "0x" + i.toString(16)
        const value = await this.provider.getStorageAt(contractAddress, slot)

        // Only include non-zero values
        if (value !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
          const change: StateChange = {
            slot,
            oldValue: "0x0", // We don't know the previous value
            newValue: value,
            operation: "ANALYSIS",
            pc: 0,
            depth: 0,
          }

          // If we have mapping information for this slot, add it
          const varInfo = this.slotToVariableMap.get(slot)
          if (varInfo) {
            change.variableName = varInfo.name
            change.typeInfo = varInfo.type
          } else {
            // Try to infer the type based on the value
            change.typeInfo = this.inferType(value)
          }

          snapshot.changes.push(change)
        }
      }

      // Only add the snapshot if we found any state
      if (snapshot.changes.length > 0) {
        this.snapshots.push(snapshot)
        this.snapshotCreatedEmitter.fire(snapshot)
        return true
      } else {
        vscode.window.showInformationMessage("No state found in the first 10 storage slots")
        return false
      }
    } catch (error) {
      console.error("Error analyzing deployed contract:", error)
      vscode.window.showErrorMessage(
        `Error analyzing deployed contract: ${error instanceof Error ? error.message : String(error)}`,
      )
      return false
    }
  }

  /**
   * Analyze a transaction by fetching its trace
   */
  public async analyzeTransaction(txHash: string) {
    if (!this.provider) {
      vscode.window.showErrorMessage("No Ethereum provider available")
      return false
    }

    try {
      // First check if the transaction exists
      const tx = await this.provider.getTransaction(txHash)
      if (!tx) {
        vscode.window.showErrorMessage("Transaction not found")
        return false
      }

      // Request debug_traceTransaction from the provider
      // Note: This requires the node to support this method
      const trace = await this.provider.send("debug_traceTransaction", [txHash, { tracer: "callTracer" }])

      if (!trace) {
        vscode.window.showErrorMessage(
          "Could not retrieve transaction trace. Ensure your node supports debug_traceTransaction",
        )
        return false
      }

      // Process the trace data
      const traceData = {
        hash: txHash,
        from: tx.from,
        to: tx.to,
        value: tx.value.toHexString(),
        structLogs: this.convertTraceFormat(trace),
      }

      this.processTraceData(traceData)
      return true
    } catch (error) {
      console.error("Error analyzing transaction:", error)
      vscode.window.showErrorMessage(
        `Error analyzing transaction: ${error instanceof Error ? error.message : String(error)}`,
      )
      return false
    }
  }

  /**
   * Convert trace format from debug_traceTransaction to the format we use
   */
  private convertTraceFormat(trace: any): any[] {
    // This is a simplified conversion - actual implementation would depend on
    // the exact format returned by your specific Ethereum node
    const structLogs: any[] = []

    // Process the call tracer result
    if (trace.calls) {
      this.processTraceCall(trace, structLogs)
    }

    return structLogs
  }

  /**
   * Process a call from the trace recursively
   */
  private processTraceCall(call: any, structLogs: any[], depth = 1) {
    // Process each opcode in the trace
    if (call.ops) {
      for (const op of call.ops) {
        // Convert to our format
        if (op.op === "SSTORE") {
          structLogs.push({
            pc: op.pc || 0,
            op: op.op,
            stack: op.stack || [],
            depth: depth,
            gas: op.gas || 0,
          })
        }
      }
    }

    // Process nested calls
    if (call.calls && Array.isArray(call.calls)) {
      for (const subcall of call.calls) {
        this.processTraceCall(subcall, structLogs, depth + 1)
      }
    }
  }

  /**
   * Clean up resources when the extension is deactivated
   */
  public dispose() {
    this.snapshotCreatedEmitter.dispose()
    this.contractAnalyzedEmitter.dispose()
  }
}
