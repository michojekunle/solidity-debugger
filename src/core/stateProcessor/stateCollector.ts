import * as vscode from "vscode"
import * as ethers from "ethers"
import * as solc from "solc"
import * as path from "path"
import { findImports } from "../utils"
import { ErrorHandler } from "../../utils/errorHandler"

export { ErrorHandler }

/**
 * Represents a change in the smart contract state
 */
export interface StateChange {
  slot: string
  oldValue: string
  newValue: string
  variableName?: string
  typeInfo?: string
  operation: string
  pc: number
  depth: number
  transaction?: string
}

/**
 * Represents a snapshot of state changes
 */
export interface StateSnapshot {
  id: number
  timestamp: number
  changes: StateChange[]
  hash?: string
  contextInfo?: any
}

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
  private errorHandler = new ErrorHandler()
  private isInitialized = false
  private initError: Error | null = null

  private snapshotCreatedEmitter = new vscode.EventEmitter<StateSnapshot>()
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

  public readonly onSnapshotCreated = this.snapshotCreatedEmitter.event
  public readonly onContractAnalyzed = this.contractAnalyzedEmitter.event
  public readonly onError = this.errorEmitter.event

  constructor(private context: vscode.ExtensionContext) {
    try {
      this.initializeProvider()
      this.setupCompilationEnvironment()
      this.isInitialized = true
      this.errorHandler.log("StateCollector initialized successfully")
    } catch (error) {
      const message = `Error initializing StateCollector: ${error instanceof Error ? error.message : String(error)}`
      this.initError = error instanceof Error ? error : new Error(message)
      this.errorHandler.handleInitializationError(message, this.initError)
    }
  }

  public isReady(): boolean {
    return this.isInitialized && this.initError === null
  }

  public getInitializationError(): Error | null {
    return this.initError
  }

  private initializeProvider() {
    try {
      const endpoints = ["http://localhost:8545", "http://localhost:7545", "http://127.0.0.1:8545"]
      let lastError: Error | null = null

      for (const endpoint of endpoints) {
        try {
          const provider = new ethers.providers.JsonRpcProvider(endpoint)
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Connection timeout")), 5000),
          )
          const connectionPromise = provider.getBlockNumber()

          Promise.race([connectionPromise, timeoutPromise])
            .then(() => {
              this.provider = provider
              this.errorHandler.log(`Connected to Ethereum node at ${endpoint}`)
            })
            .catch((error) => {
              lastError = error
              this.errorHandler.warn(`Failed to connect to ${endpoint}`, "PROVIDER_CONNECT")
            })

          if (this.provider) break
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error))
          this.errorHandler.warn(`Error trying ${endpoint}`, "PROVIDER_INIT")
        }
      }

      if (!this.provider) {
        this.errorHandler.warn(
          "Could not connect to any local Ethereum node - some features will be unavailable",
          "NO_PROVIDER",
        )
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      this.errorHandler.handleError("PROVIDER_INIT_ERROR", "Error initializing Ethereum provider", "", err)
    }
  }

  private setupCompilationEnvironment() {
    this.errorHandler.log("Solidity compilation environment initialized")
  }

  public clearState() {
    this.snapshots = []
    this.slotToVariableMap.clear()
  }

  public processTraceData(traceData: any): StateSnapshot {
    try {
      if (!traceData) {
        throw new Error("Trace data is required")
      }

      if (!Array.isArray(traceData.structLogs)) {
        throw new Error("Invalid trace data format: structLogs must be an array")
      }

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

      const slotValues: Map<string, string> = new Map()

      for (const log of traceData.structLogs) {
        if (!log || typeof log !== "object") {
          this.errorHandler.warn("Invalid log entry encountered", "TRACE_PROCESSING")
          continue
        }

        if (log.op === "SSTORE" && Array.isArray(log.stack) && log.stack.length >= 2) {
          const slot = log.stack[log.stack.length - 2]
          const value = log.stack[log.stack.length - 1]

          if (!slot || !value) {
            this.errorHandler.warn("Invalid SSTORE stack values", "TRACE_PROCESSING")
            continue
          }

          const oldValue = slotValues.get(slot) || "0x0"

          if (oldValue !== value) {
            const change: StateChange = {
              slot,
              oldValue,
              newValue: value,
              operation: log.op,
              pc: log.pc || 0,
              depth: log.depth || 0,
            }

            const varInfo = this.slotToVariableMap.get(slot)
            if (varInfo) {
              change.variableName = varInfo.name
              change.typeInfo = varInfo.type
            } else {
              change.typeInfo = this.inferType(value)
            }

            snapshot.changes.push(change)
            slotValues.set(slot, value)
          }
        }
      }

      this.snapshots.push(snapshot)
      this.snapshotCreatedEmitter.fire(snapshot)

      return snapshot
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      const message = `Error processing trace data: ${err.message}`
      this.errorHandler.handleError("TRACE_PROCESSING_ERROR", message, "", err)
      this.errorEmitter.fire({
        code: "TRACE_PROCESSING_ERROR",
        message,
      })

      return {
        id: this.snapshots.length,
        timestamp: Date.now(),
        changes: [],
      }
    }
  }

  public addSimulatedSnapshot(snapshot: StateSnapshot): void {
    if (!snapshot || typeof snapshot !== "object") {
      this.errorHandler.warn("Invalid snapshot provided", "ADD_SNAPSHOT")
      return
    }

    snapshot.id = this.snapshots.length
    this.snapshots.push(snapshot)
    this.snapshotCreatedEmitter.fire(snapshot)
  }

  public async analyzeActiveContract() {
    try {
      const editor = vscode.window.activeTextEditor
      if (!editor || editor.document.languageId !== "solidity") {
        throw new Error("No Solidity file is currently active")
      }

      const content = editor.document.getText()
      const filePath = editor.document.uri.fsPath

      const compilationResult = await this.compileSolidityContract(content, filePath)

      if (!compilationResult) {
        throw new Error("Compilation returned no result")
      }

      this.processCompilationOutput(compilationResult)
      this.createInitialStateSnapshot()

      this.contractAnalyzedEmitter.fire({
        contractName: this.currentContractName,
        abi: this.currentContractAbi,
        storageLayout: this.storageLayout,
      })

      return true
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      const message = `Error analyzing active contract: ${err.message}`
      this.errorHandler.handleError("CONTRACT_ANALYSIS_ERROR", message, "", err)
      this.errorEmitter.fire({
        code: "CONTRACT_ANALYSIS_ERROR",
        message,
      })
      return false
    }
  }

  private createInitialStateSnapshot() {
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

    if (this.storageLayout && Array.isArray(this.storageLayout.storage)) {
      for (const item of this.storageLayout.storage) {
        if (!item || !item.slot) {
          this.errorHandler.warn("Invalid storage item encountered", "STORAGE_LAYOUT")
          continue
        }

        const slot = "0x" + Number.parseInt(item.slot).toString(16)
        const defaultValue = this.getDefaultValueForType(item.type)

        const change: StateChange = {
          slot,
          oldValue: "0x0",
          newValue: defaultValue,
          variableName: item.label || `slot_${item.slot}`,
          typeInfo: this.mapTypeToFriendlyName(item.type),
          operation: "INITIAL",
          pc: 0,
          depth: 0,
        }

        snapshot.changes.push(change)
      }
    }

    if (snapshot.changes.length > 0) {
      this.snapshots.push(snapshot)
      this.snapshotCreatedEmitter.fire(snapshot)
    }
  }

  private getDefaultValueForType(type: string): string {
    if (type.startsWith("uint") || type.startsWith("int")) {
      return "0x0"
    } else if (type === "bool") {
      return "0x0"
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

  private async compileSolidityContract(source: string, filePath: string): Promise<any> {
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

        const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }))

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

  private processCompilationOutput(output: any) {
    try {
      if (!output || !output.contracts) {
        throw new Error("Invalid compilation output: contracts not found")
      }

      const fileNames = Object.keys(output.contracts)
      if (fileNames.length === 0) {
        throw new Error("No contracts found in compilation output")
      }

      const fileName = fileNames[0]
      const contractNames = Object.keys(output.contracts[fileName])

      if (contractNames.length === 0) {
        throw new Error("No contracts found in file")
      }

      const contractName = contractNames[0]
      const contract = output.contracts[fileName][contractName]

      if (!contract) {
        throw new Error("Contract not found in output")
      }

      this.currentContractName = contractName
      this.currentContractAbi = contract.abi || []
      this.storageLayout = contract.storageLayout

      if (this.storageLayout && Array.isArray(this.storageLayout.storage)) {
        this.slotToVariableMap.clear()

        for (const item of this.storageLayout.storage) {
          if (!item || !item.slot) {
            this.errorHandler.warn("Invalid storage item in layout", "COMPILATION_PROCESSING")
            continue
          }

          const slot = "0x" + Number.parseInt(item.slot).toString(16)
          this.slotToVariableMap.set(slot, {
            name: item.label || `slot_${item.slot}`,
            type: this.mapTypeToFriendlyName(item.type),
          })
        }
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      const message = `Error processing compilation output: ${err.message}`
      this.errorHandler.handleError("COMPILATION_PROCESSING_ERROR", message, "", err)
      throw error
    }
  }

  public getCurrentContractAbi(): any[] {
    return this.currentContractAbi
  }

  public getCurrentContractName(): string {
    return this.currentContractName
  }

  public getStorageVariables(): any[] {
    if (!this.storageLayout || !Array.isArray(this.storageLayout.storage)) {
      return []
    }

    return this.storageLayout.storage
      .filter((item: any) => item && item.slot)
      .map((item: any) => ({
        slot: "0x" + Number.parseInt(item.slot).toString(16),
        name: item.label || `slot_${item.slot}`,
        type: this.mapTypeToFriendlyName(item.type),
        offset: item.offset || 0,
      }))
  }

  private mapTypeToFriendlyName(solidityType: string): string {
    return TYPE_MAPPING[solidityType] || solidityType
  }

  private inferType(value: string): string {
    const cleanValue = value.startsWith("0x") ? value.slice(2) : value

    if (cleanValue === "0" || cleanValue === "1") {
      return "Boolean or Number"
    }

    if (cleanValue.length === 40) {
      return "Likely Address"
    }

    if (cleanValue.length <= 4) {
      return "Small Number"
    }

    return "Number or Bytes"
  }

  public getSnapshots(): StateSnapshot[] {
    return [...this.snapshots]
  }

  public getCurrentState(): Record<string, any> {
    const state: Record<string, any> = {}

    for (const snapshot of this.snapshots) {
      for (const change of snapshot.changes) {
        const key = change.variableName || `slot_${change.slot}`

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

  public async analyzeDeployedContract(contractAddress: string) {
    try {
      if (!this.provider) {
        throw new Error("No Ethereum provider available - cannot analyze deployed contract")
      }

      if (!contractAddress || typeof contractAddress !== "string") {
        throw new Error("Invalid contract address provided")
      }

      const code = await this.provider.getCode(contractAddress)
      if (code === "0x") {
        throw new Error("No contract deployed at this address")
      }

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

      for (let i = 0; i < 10; i++) {
        const slot = "0x" + i.toString(16)
        const value = await this.provider.getStorageAt(contractAddress, slot)

        if (value !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
          const change: StateChange = {
            slot,
            oldValue: "0x0",
            newValue: value,
            operation: "ANALYSIS",
            pc: 0,
            depth: 0,
          }

          const varInfo = this.slotToVariableMap.get(slot)
          if (varInfo) {
            change.variableName = varInfo.name
            change.typeInfo = varInfo.type
          } else {
            change.typeInfo = this.inferType(value)
          }

          snapshot.changes.push(change)
        }
      }

      if (snapshot.changes.length > 0) {
        this.snapshots.push(snapshot)
        this.snapshotCreatedEmitter.fire(snapshot)
        return true
      } else {
        throw new Error("No state found in the first 10 storage slots")
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      const message = `Error analyzing deployed contract: ${err.message}`
      this.errorHandler.handleError("DEPLOYED_CONTRACT_ERROR", message, "", err)
      this.errorEmitter.fire({
        code: "DEPLOYED_CONTRACT_ERROR",
        message,
      })
      return false
    }
  }

  public async analyzeTransaction(txHash: string) {
    try {
      if (!this.provider) {
        throw new Error("No Ethereum provider available - cannot analyze transaction")
      }

      if (!txHash || typeof txHash !== "string") {
        throw new Error("Invalid transaction hash provided")
      }

      const tx = await this.provider.getTransaction(txHash)
      if (!tx) {
        throw new Error("Transaction not found")
      }

      const trace = await this.provider.send("debug_traceTransaction", [txHash, { tracer: "callTracer" }])

      if (!trace) {
        throw new Error("Could not retrieve transaction trace. Ensure your node supports debug_traceTransaction")
      }

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
      const err = error instanceof Error ? error : new Error(String(error))
      const message = `Error analyzing transaction: ${err.message}`
      this.errorHandler.handleError("TRANSACTION_ANALYSIS_ERROR", message, "", err)
      this.errorEmitter.fire({
        code: "TRANSACTION_ANALYSIS_ERROR",
        message,
      })
      return false
    }
  }

  private convertTraceFormat(trace: any): any[] {
    const structLogs: any[] = []

    if (trace.calls) {
      this.processTraceCall(trace, structLogs)
    }

    return structLogs
  }

  private processTraceCall(call: any, structLogs: any[], depth = 1) {
    if (call.ops) {
      for (const op of call.ops) {
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

    if (call.calls && Array.isArray(call.calls)) {
      for (const subcall of call.calls) {
        this.processTraceCall(subcall, structLogs, depth + 1)
      }
    }
  }

  public dispose() {
    this.snapshotCreatedEmitter.dispose()
    this.contractAnalyzedEmitter.dispose()
    this.errorEmitter.dispose()
  }
}
