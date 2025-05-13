import * as vscode from "vscode";
import * as ethers from "ethers";
import * as solc from "solc";
// import * as fs from 'fs';
import * as path from "path";

/**
 * Represents a change in the smart contract state
 */
export interface StateChange {
  slot: string; // Storage slot that changed
  oldValue: string; // Previous value (hex string)
  newValue: string; // New value (hex string)
  variableName?: string; // If available, the variable name associated with this slot
  typeInfo?: string; // Type information for the value (uint256, address, etc.)
  operation: string; // Operation that caused this change (SSTORE, etc.)
  pc: number; // Program counter at time of change
  depth: number; // Call depth
  transaction?: string; // Transaction hash if available
}

/**
 * Represents a snapshot of state changes in a specific transaction/call
 */
export interface StateSnapshot {
  id: number; // Sequential ID of this snapshot
  timestamp: number; // When this snapshot was created
  changes: StateChange[]; // State changes in this snapshot
  hash?: string; // Transaction hash if available
  contextInfo?: any; // Additional context about this snapshot
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
};

/**
 * Service for collecting and analyzing smart contract state changes
 */
export class StateCollector implements vscode.Disposable {
  private snapshots: StateSnapshot[] = [];
  private slotToVariableMap: Map<string, { name: string; type: string }> =
    new Map();
  private currentContractAbi: any[] = [];
  private storageLayout: any = null;
  private provider: ethers.providers.JsonRpcProvider | null = null;

  // Event emitters
  private snapshotCreatedEmitter = new vscode.EventEmitter<StateSnapshot>();

  public readonly onSnapshotCreated = this.snapshotCreatedEmitter.event;

  constructor(private context: vscode.ExtensionContext) {
    // Try to connect to a local Ethereum node
    this.initializeProvider();

    // Set up Solidity compilation environment
    this.setupCompilationEnvironment();
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
      ];

      for (const endpoint of endpoints) {
        try {
          const provider = new ethers.providers.JsonRpcProvider(endpoint);
          // Test the connection
          provider
            .getBlockNumber()
            .then(() => {
              this.provider = provider;
              console.log(`Connected to Ethereum node at ${endpoint}`);
            })
            .catch(() => {
              // Connection failed, try next endpoint
            });

          if (this.provider) break;
        } catch (error) {
          // Try next endpoint
        }
      }

      if (!this.provider) {
        console.log("Could not connect to any local Ethereum node");
      }
    } catch (error) {
      console.error("Error initializing Ethereum provider:", error);
    }
  }

  /**
   * Set up the Solidity compilation environment
   */
  private setupCompilationEnvironment() {
    // This method would normally set up the proper solc-js environment
    // For VSCode extensions, you might need to bundle solc or use solc installed by the user
    console.log("Solidity compilation environment initialized");
  }

  /**
   * Clear all collected state
   */
  public clearState() {
    this.snapshots = [];
    this.slotToVariableMap.clear();
  }

  /**
   * Process trace data from a transaction and extract state changes
   */
  public processTraceData(traceData: any): StateSnapshot {
    // Create a new snapshot for this transaction
    const snapshotId = this.snapshots.length;
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
    };

    // Track the slot values for this transaction
    const slotValues: Map<string, string> = new Map();

    // Process each log entry in the trace
    for (const log of traceData.structLogs) {
      // We're mainly interested in SSTORE operations which change state
      if (log.op === "SSTORE") {
        const slot = log.stack[log.stack.length - 2]; // Second to last item on stack is the slot
        const value = log.stack[log.stack.length - 1]; // Last item on stack is the value

        // Get the previous value for this slot
        const oldValue = slotValues.get(slot) || "0x0";

        // Only record if the value changed
        if (oldValue !== value) {
          const change: StateChange = {
            slot,
            oldValue,
            newValue: value,
            operation: log.op,
            pc: log.pc,
            depth: log.depth,
          };

          // If we have mapping information for this slot, add it
          const varInfo = this.slotToVariableMap.get(slot);
          if (varInfo) {
            change.variableName = varInfo.name;
            change.typeInfo = varInfo.type;
          } else {
            // Try to infer the type based on the value
            change.typeInfo = this.inferType(value);
          }

          // Add the change to the snapshot
          snapshot.changes.push(change);

          // Update our tracking of the current value
          slotValues.set(slot, value);
        }
      }
    }

    // Add the snapshot to our collection
    this.snapshots.push(snapshot);

    // Notify listeners about the new snapshot
    this.snapshotCreatedEmitter.fire(snapshot);

    return snapshot;
  }

  /**
   * Process an active editor to analyze storage layout of contract
   */
  public async analyzeActiveContract() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== "solidity") {
      vscode.window.showWarningMessage("No Solidity file is currently active");
      return false;
    }

    try {
      // Get the file content
      const content = editor.document.getText();
      const filePath = editor.document.uri.fsPath;

      // Compile the contract to get storage layout
      const compilationResult = await this.compileSolidityContract(
        content,
        filePath
      );
      if (!compilationResult) {
        vscode.window.showErrorMessage("Failed to compile contract");
        return false;
      }

      // Process the compilation output
      this.processCompilationOutput(compilationResult);
      return true;
    } catch (error) {
      console.error("Error analyzing contract:", error);
      vscode.window.showErrorMessage(
        `Error analyzing contract: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return false;
    }
  }

  /**
   * Compile a Solidity contract and return the result
   */
  private async compileSolidityContract(
    source: string,
    filePath: string
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        // Prepare input for solc
        const fileName = path.basename(filePath);
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
        };

        // Compile
        const output = JSON.parse(solc.compile(JSON.stringify(input)));

        // Check for errors
        if (output.errors) {
          const hasError = output.errors.some(
            (error: any) => error.severity === "error"
          );
          if (hasError) {
            reject(
              new Error("Compilation failed: " + JSON.stringify(output.errors))
            );
            return;
          }
        }

        resolve(output);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Process the output from the Solidity compiler
   */
  private processCompilationOutput(output: any) {
    // Find the compiled contract
    const fileName = Object.keys(output.contracts)[0];
    const contractName = Object.keys(output.contracts[fileName])[0];
    const contract = output.contracts[fileName][contractName];

    // Save ABI for later use
    this.currentContractAbi = contract.abi;

    // Process the storage layout
    this.storageLayout = contract.storageLayout;

    // Map storage slots to variable names
    if (this.storageLayout && this.storageLayout.storage) {
      this.slotToVariableMap.clear();

      for (const item of this.storageLayout.storage) {
        const slot = "0x" + parseInt(item.slot).toString(16);
        this.slotToVariableMap.set(slot, {
          name: item.label,
          type: this.mapTypeToFriendlyName(item.type),
        });
      }
    }
  }

  /**
   * Map a Solidity type to a more user-friendly description
   */
  private mapTypeToFriendlyName(solidityType: string): string {
    return TYPE_MAPPING[solidityType] || solidityType;
  }

  /**
   * Attempt to infer the type of a value based on its format
   */
  private inferType(value: string): string {
    // Remove 0x prefix if present
    const cleanValue = value.startsWith("0x") ? value.slice(2) : value;

    // Check if it's a small number (likely a bool or small uint)
    if (cleanValue === "0" || cleanValue === "1") {
      return "Boolean or Number";
    }

    // Check if it looks like an address (20 bytes)
    if (cleanValue.length === 40) {
      return "Likely Address";
    }

    // Check if it's a small number
    if (cleanValue.length <= 4) {
      return "Small Number";
    }

    // Default assumption for larger values
    return "Number or Bytes";
  }

  /**
   * Get the current available contract state snapshots
   */
  public getSnapshots(): StateSnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Fetch and analyze the runtime state of a deployed contract
   */
  public async analyzeDeployedContract(contractAddress: string) {
    if (!this.provider) {
      vscode.window.showErrorMessage("No Ethereum provider available");
      return false;
    }

    try {
      // Check if the address exists
      const code = await this.provider.getCode(contractAddress);
      if (code === "0x") {
        vscode.window.showErrorMessage("No contract deployed at this address");
        return false;
      }

      // Create a new snapshot for this analysis
      const snapshotId = this.snapshots.length;
      const snapshot: StateSnapshot = {
        id: snapshotId,
        timestamp: Date.now(),
        changes: [],
        contextInfo: {
          type: "static_analysis",
          address: contractAddress,
        },
      };

      // Get storage values for the first few slots
      for (let i = 0; i < 10; i++) {
        const slot = "0x" + i.toString(16);
        const value = await this.provider.getStorageAt(contractAddress, slot);

        // Only include non-zero values
        if (
          value !==
          "0x0000000000000000000000000000000000000000000000000000000000000000"
        ) {
          const change: StateChange = {
            slot,
            oldValue: "0x0", // We don't know the previous value
            newValue: value,
            operation: "ANALYSIS",
            pc: 0,
            depth: 0,
          };

          // If we have mapping information for this slot, add it
          const varInfo = this.slotToVariableMap.get(slot);
          if (varInfo) {
            change.variableName = varInfo.name;
            change.typeInfo = varInfo.type;
          } else {
            // Try to infer the type based on the value
            change.typeInfo = this.inferType(value);
          }

          snapshot.changes.push(change);
        }
      }

      // Only add the snapshot if we found any state
      if (snapshot.changes.length > 0) {
        this.snapshots.push(snapshot);
        this.snapshotCreatedEmitter.fire(snapshot);
        return true;
      } else {
        vscode.window.showInformationMessage(
          "No state found in the first 10 storage slots"
        );
        return false;
      }
    } catch (error) {
      console.error("Error analyzing deployed contract:", error);
      vscode.window.showErrorMessage(
        `Error analyzing deployed contract: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return false;
    }
  }

  /**
   * Analyze a transaction by fetching its trace
   */
  public async analyzeTransaction(txHash: string) {
    if (!this.provider) {
      vscode.window.showErrorMessage("No Ethereum provider available");
      return false;
    }

    try {
      // First check if the transaction exists
      const tx = await this.provider.getTransaction(txHash);
      if (!tx) {
        vscode.window.showErrorMessage("Transaction not found");
        return false;
      }

      // Request debug_traceTransaction from the provider
      // Note: This requires the node to support this method
      const trace = await this.provider.send("debug_traceTransaction", [
        txHash,
        { tracer: "callTracer" },
      ]);

      if (!trace) {
        vscode.window.showErrorMessage(
          "Could not retrieve transaction trace. Ensure your node supports debug_traceTransaction"
        );
        return false;
      }

      // Process the trace data
      const traceData = {
        hash: txHash,
        from: tx.from,
        to: tx.to,
        value: tx.value.toHexString(),
        structLogs: this.convertTraceFormat(trace),
      };

      this.processTraceData(traceData);
      return true;
    } catch (error) {
      console.error("Error analyzing transaction:", error);
      vscode.window.showErrorMessage(
        `Error analyzing transaction: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return false;
    }
  }

  /**
   * Convert trace format from debug_traceTransaction to the format we use
   */
  private convertTraceFormat(trace: any): any[] {
    // This is a simplified conversion - actual implementation would depend on
    // the exact format returned by your specific Ethereum node
    const structLogs: any[] = [];

    // Process the call tracer result
    if (trace.calls) {
      this.processTraceCall(trace, structLogs);
    }

    return structLogs;
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
          });
        }
      }
    }

    // Process nested calls
    if (call.calls && Array.isArray(call.calls)) {
      for (const subcall of call.calls) {
        this.processTraceCall(subcall, structLogs, depth + 1);
      }
    }
  }

  /**
   * Analyze memory dumps from debugging sessions
   */
  public analyzeMemoryDump(memoryData: any) {
    try {
      // Create a new snapshot for this memory dump
      const snapshotId = this.snapshots.length;
      const snapshot: StateSnapshot = {
        id: snapshotId,
        timestamp: Date.now(),
        changes: [],
        contextInfo: {
          type: "memory_dump",
        },
      };

      // Process the memory data
      for (const [slot, value] of Object.entries(memoryData)) {
        const change: StateChange = {
          slot,
          oldValue: "0x0", // We don't know the previous value
          newValue: value as string,
          operation: "MEMORY_DUMP",
          pc: 0,
          depth: 0,
        };

        // If we have mapping information for this slot, add it
        const varInfo = this.slotToVariableMap.get(slot);
        if (varInfo) {
          change.variableName = varInfo.name;
          change.typeInfo = varInfo.type;
        } else {
          // Try to infer the type based on the value
          change.typeInfo = this.inferType(value as string);
        }

        snapshot.changes.push(change);
      }

      // Add the snapshot to our collection
      this.snapshots.push(snapshot);

      // Notify listeners about the new snapshot
      this.snapshotCreatedEmitter.fire(snapshot);

      return snapshot;
    } catch (error) {
      console.error("Error analyzing memory dump:", error);
      vscode.window.showErrorMessage(
        `Error analyzing memory dump: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return null;
    }
  }

  /**
   * Collect real-time state from a debug session
   * This implementation integrates with the VSCode debug API to track contract state changes
   */
  public collectDebugState(
    debugSession: vscode.DebugSession
  ): vscode.Disposable {
    console.log("Debug session state collection started", debugSession);

    // Create a composite disposable to store all event subscriptions
    const disposables: vscode.Disposable[] = [];

    // Track the current snapshot being built
    let currentSnapshot: StateSnapshot | null = null;
    let lastKnownState: Map<string, string> = new Map();

    // Helper function to create a new snapshot
    const createNewSnapshot = () => {
      const snapshotId = this.snapshots.length;
      currentSnapshot = {
        id: snapshotId,
        timestamp: Date.now(),
        changes: [],
        contextInfo: {
          type: "debug_session",
          debugSessionId: debugSession.id,
          debugSessionName: debugSession.name,
        },
      };
    };

    // Helper function to finalize and save a snapshot
    const finalizeSnapshot = () => {
      if (currentSnapshot && currentSnapshot.changes.length > 0) {
        this.snapshots.push(currentSnapshot);
        this.snapshotCreatedEmitter.fire(currentSnapshot);
        currentSnapshot = null;
      }
    };

    // Helper function to compare and record state changes
    const recordStateChanges = async (frameId: number) => {
      try {
        // Only create a snapshot if we're actually going to add changes
        if (!currentSnapshot) {
          createNewSnapshot();
        }

        // Get contract storage state at this point
        // We need to evaluate expressions to get storage values
        const storageSlots = Array.from(this.slotToVariableMap.keys());

        // Also include some standard slots if we don't have mapping info
        if (storageSlots.length === 0) {
          // Add the first 10 slots if we don't have specific mapping info
          for (let i = 0; i < 10; i++) {
            storageSlots.push("0x" + i.toString(16));
          }
        }

        // Evaluate each storage slot
        for (const slot of storageSlots) {
          // We need to form a debug expression to evaluate the storage slot
          // The exact expression depends on the debug adapter being used

          // Different debug adapters might require different expressions
          // Here we'll try a few common formats
          const expressions = [
            `debug.getStorageAt("${slot}")`, // Generic format
            `ethereum.getStorageAt(address, ${slot})`, // Ethereum specific
            `web3.eth.getStorageAt(contract.address, "${slot}")`, // Web3 format
            `storage["${slot}"]`, // Direct storage access if available
          ];

          let valueFound = false;

          for (const expr of expressions) {
            try {
              const response =
                await vscode.debug.activeDebugSession?.customRequest(
                  "evaluate",
                  {
                    expression: expr,
                    frameId: frameId,
                    context: "watch",
                  }
                );

              if (response && response.result) {
                // Found a value
                const newValue = response.result.startsWith("0x")
                  ? response.result
                  : "0x" + response.result;

                // Get the previous value
                const oldValue = lastKnownState.get(slot) || "0x0";

                // Only record if the value changed
                if (oldValue !== newValue) {
                  const change: StateChange = {
                    slot,
                    oldValue,
                    newValue,
                    operation: "DEBUG_STORAGE",
                    pc: 0, // We might get this from debug info
                    depth: 0, // We might get this from debug info
                  };

                  // If we have mapping information for this slot, add it
                  const varInfo = this.slotToVariableMap.get(slot);
                  if (varInfo) {
                    change.variableName = varInfo.name;
                    change.typeInfo = varInfo.type;
                  } else {
                    // Try to infer the type based on the value
                    change.typeInfo = this.inferType(newValue);
                  }

                  // Update our tracking of the current value
                  lastKnownState.set(slot, newValue);

                  // Add the change to the snapshot
                  if (currentSnapshot) {
                    currentSnapshot.changes.push(change);
                  }
                }

                valueFound = true;
                break; // No need to try other expressions
              }
            } catch (error) {
              // This expression format didn't work, try the next one
              console.log(`Expression "${expr}" failed: ${error}`);
            }
          }

          if (!valueFound) {
            console.log(
              `Could not evaluate storage slot ${slot} with any known expression format`
            );
          }
        }

        // Also try to get the program counter and other debug information
        try {
          const stackFrames =
            await vscode.debug.activeDebugSession?.customRequest("stackTrace", {
              threadId: 0, // Assuming the main thread is 0
            });

          if (
            stackFrames &&
            stackFrames.stackFrames &&
            stackFrames.stackFrames.length > 0
          ) {
            // Get the top frame
            const topFrame = stackFrames.stackFrames[0];

            // Update PC and location info in our changes
            if (currentSnapshot) {
              for (const change of currentSnapshot.changes) {
                change.pc = topFrame.instructionPointerReference || 0;

                // Add additional context
                if (!currentSnapshot.contextInfo) {
                  currentSnapshot.contextInfo = {};
                }

                currentSnapshot.contextInfo.location = {
                  source: topFrame.source?.name || "unknown",
                  line: topFrame.line || 0,
                  column: topFrame.column || 0,
                };
              }
            }
          }
        } catch (error) {
          console.log(`Could not get stack frame information: ${error}`);
        }
      } catch (error) {
        console.error("Error recording state changes:", error);
      }
    };

    // Register for stopped events (breakpoints, step operations, etc.)
    disposables.push(
      vscode.debug.onDidChangeBreakpoints(async (e) => {
        // When breakpoints change, we might want to annotate them with storage info
        // This is more of an enhancement than core functionality
        console.log("Breakpoints changed:", e);
      })
    );

    // Listen for debug sessions being started
    disposables.push(
      vscode.debug.onDidStartDebugSession((session) => {
        if (session.id === debugSession.id) {
          console.log(`Debug session ${session.id} started`);
          // Clear our state tracking for a new session
          lastKnownState.clear();
        }
      })
    );

    // Listen for debug sessions being terminated
    disposables.push(
      vscode.debug.onDidTerminateDebugSession((session) => {
        if (session.id === debugSession.id) {
          console.log(`Debug session ${session.id} terminated`);
          // Finalize any pending snapshot
          finalizeSnapshot();
        }
      })
    );

    // The main event - listen for when execution stops at a breakpoint or step
    disposables.push(
      vscode.debug.onDidReceiveDebugSessionCustomEvent(async (e) => {
        if (e.session.id !== debugSession.id) {
          return; // Not our debug session
        }

        // Handle various debug events
        switch (e.event) {
          case "stopped":
            console.log("Execution stopped:", e.body);

            // Get the current stack frame to evaluate expressions
            try {
              const stackTraceResponse = await e.session.customRequest(
                "stackTrace",
                {
                  threadId: e.body.threadId,
                }
              );

              if (
                stackTraceResponse &&
                stackTraceResponse.stackFrames &&
                stackTraceResponse.stackFrames.length > 0
              ) {
                const frameId = stackTraceResponse.stackFrames[0].id;

                // Record state changes at this point
                await recordStateChanges(frameId);
              }
            } catch (error) {
              console.error("Error getting stack trace:", error);
            }
            break;

          case "continued":
            // Execution is continuing, finalize the current snapshot
            finalizeSnapshot();
            break;

          case "exited":
            // Program exited, finalize any snapshot
            finalizeSnapshot();
            break;

          case "terminated":
            // Debug session terminated, finalize any snapshot
            finalizeSnapshot();
            break;

          case "memory":
            // If the debug adapter provides memory events, we can use them
            if (e.body && e.body.memoryReference) {
              console.log("Memory changed:", e.body);
              // This could be useful for tracking memory changes
            }
            break;

          // Handle other relevant events as needed
        }
      })
    );

    // Specifically handle the `breakpoint` event if the debug adapter supports it
    disposables.push(
      vscode.debug.onDidReceiveDebugSessionCustomEvent(async (e) => {
        if (e.session.id !== debugSession.id || e.event !== "breakpoint") {
          return;
        }

        console.log("Breakpoint hit:", e.body);

        // Similar logic to the 'stopped' event but specific to breakpoints
        try {
          // Create a new snapshot for this breakpoint hit
          createNewSnapshot();

          if (currentSnapshot && e.body) {
            // Add breakpoint specific info
            currentSnapshot.contextInfo = {
              ...currentSnapshot.contextInfo,
              breakpointId: e.body.breakpoint?.id,
              breakpointLine: e.body.breakpoint?.line,
              reason: "breakpoint",
            };
          }

          // Get the current stack frame to evaluate expressions
          if (e.body.threadId) {
            const stackTraceResponse = await e.session.customRequest(
              "stackTrace",
              {
                threadId: e.body.threadId,
              }
            );

            if (
              stackTraceResponse &&
              stackTraceResponse.stackFrames &&
              stackTraceResponse.stackFrames.length > 0
            ) {
              const frameId = stackTraceResponse.stackFrames[0].id;

              // Record state changes at this breakpoint
              await recordStateChanges(frameId);
            }
          }
        } catch (error) {
          console.error("Error processing breakpoint event:", error);
        }
      })
    );

    // Listen for step completed events
    disposables.push(
      vscode.debug.onDidReceiveDebugSessionCustomEvent(async (e) => {
        if (e.session.id !== debugSession.id || e.event !== "step") {
          return;
        }

        console.log("Step completed:", e.body);

        // Create a new snapshot for this step
        createNewSnapshot();

        if (currentSnapshot && e.body) {
          // Add step specific info
          currentSnapshot.contextInfo = {
            ...currentSnapshot.contextInfo,
            reason: "step",
            stepType: e.body.type, // 'in', 'out', 'over', etc.
          };
        }

        // Get the current stack frame to evaluate expressions
        if (e.body.threadId) {
          try {
            const stackTraceResponse = await e.session.customRequest(
              "stackTrace",
              {
                threadId: e.body.threadId,
              }
            );

            if (
              stackTraceResponse &&
              stackTraceResponse.stackFrames &&
              stackTraceResponse.stackFrames.length > 0
            ) {
              const frameId = stackTraceResponse.stackFrames[0].id;

              // Record state changes after this step
              await recordStateChanges(frameId);
            }
          } catch (error) {
            console.error("Error processing step event:", error);
          }
        }
      })
    );

    // Also set up a command that can be triggered manually to capture state
    disposables.push(
      vscode.commands.registerCommand(
        "ethereumStateTracker.captureDebugState",
        async () => {
          if (
            !vscode.debug.activeDebugSession ||
            vscode.debug.activeDebugSession.id !== debugSession.id
          ) {
            vscode.window.showWarningMessage(
              "No active debug session to capture state from"
            );
            return;
          }

          try {
            // Get the current stack frame to evaluate expressions
            const stackTraceResponse =
              await vscode.debug.activeDebugSession.customRequest(
                "stackTrace",
                {
                  threadId: 0, // Assuming main thread
                }
              );

            if (
              stackTraceResponse &&
              stackTraceResponse.stackFrames &&
              stackTraceResponse.stackFrames.length > 0
            ) {
              const frameId = stackTraceResponse.stackFrames[0].id;

              // Create a new snapshot specifically for this manual capture
              createNewSnapshot();

              if (currentSnapshot) {
                currentSnapshot.contextInfo = {
                  ...currentSnapshot.contextInfo,
                  reason: "manual_capture",
                };
              }

              // Record state changes for this manual capture
              await recordStateChanges(frameId);

              // Finalize the snapshot immediately
              finalizeSnapshot();

              vscode.window.showInformationMessage(
                "Debug state captured successfully"
              );
            } else {
              vscode.window.showWarningMessage(
                "Could not get stack frames from debug session"
              );
            }
          } catch (error) {
            console.error("Error capturing debug state manually:", error);
            vscode.window.showErrorMessage(
              `Error capturing debug state: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          }
        }
      )
    );

    // Create a composite disposable from all registered listeners
    return vscode.Disposable.from(...disposables);
  }

  /**
   * Clean up resources when the extension is deactivated
   */
  public dispose() {
    this.snapshotCreatedEmitter.dispose();
  }
}
