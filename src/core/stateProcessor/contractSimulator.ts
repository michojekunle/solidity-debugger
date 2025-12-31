import * as ethers from "ethers";
import { ErrorHandler } from "../../utils/errorHandler";
import type { StateCollector, StateChange, StateSnapshot } from "./stateCollector";

/**
 * Enhanced contract simulator with better state tracking and function routing
 */
export class ContractSimulator {
  private contractAbi: any[] = [];
  private contractInterface: ethers.utils.Interface | null = null;
  private stateCollector: StateCollector;
  private errorHandler = new ErrorHandler();
  private functionHistory: Array<{ functionName: string; inputs: any[]; timestamp: number }> = [];

  constructor(stateCollector: StateCollector) {
    this.stateCollector = stateCollector;
  }

  /**
   * Set the contract ABI for simulation
   */
  public setContractAbi(abi: any[]) {
    try {
      if (!Array.isArray(abi) || abi.length === 0) {
        this.errorHandler.warn("Empty or invalid ABI provided", "ABI_VALIDATION");
        return;
      }

      this.contractAbi = abi;
      this.contractInterface = new ethers.utils.Interface(abi);
      this.errorHandler.log("Contract interface initialized for simulation");
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.errorHandler.handleError("ABI_INIT_ERROR", "Error initializing contract interface", "", err);
      this.contractInterface = null;
    }
  }

  /**
   * Get all available functions from the contract ABI
   */
  public getContractFunctions() {
    if (!this.contractAbi || this.contractAbi.length === 0) {
      return [];
    }

    return this.contractAbi
      .filter((item) => item.type === "function")
      .map((func) => ({
        name: func.name,
        inputs: func.inputs || [],
        outputs: func.outputs || [],
        stateMutability: func.stateMutability || "nonpayable",
      }));
  }

  /**
   * Added comprehensive function simulation with better routing
   */
  public async simulateFunction(
    functionName: string,
    inputs: any[],
    currentState: Record<string, any>,
  ): Promise<{ stateChanges: StateChange[]; newState: Record<string, any>; gasUsed?: number; trace?: any }> {
    try {
      if (!functionName || typeof functionName !== "string") {
        throw new Error("Invalid function name provided");
      }

      if (!Array.isArray(inputs)) {
        throw new Error("Inputs must be an array");
      }

      this.errorHandler.log(`Simulating function ${functionName} with ${inputs.length} inputs`);

      if (!this.contractInterface) {
        this.errorHandler.warn("Contract interface not initialized", "SIMULATION_ERROR");
        return { stateChanges: [], newState: currentState };
      }

      const funcFragment = this.contractInterface.getFunction(functionName);
      if (!funcFragment) {
        throw new Error(`Function ${functionName} not found in ABI`);
      }

      // Check if view/pure - usually no state changes, but we might want to see return values? 
      // For now, keep existing logic:
      if (funcFragment.stateMutability === "view" || funcFragment.stateMutability === "pure") {
         // Maybe execute purely to show result? 
         // For state visualizer, we care about SSTORE.
         return { stateChanges: [], newState: currentState };
      }

      const newState = { ...currentState };
      let stateChanges: StateChange[] = [];
      
      // Try Runtime Simulation via RPC if we have an address or provider
      // Check if StateCollector allows tracking
      const contractAddress = this.stateCollector.getCurrentContractAddress();
      
      if (contractAddress && this.contractInterface && this.stateCollector.isReady()) {
          try {
             // 1. Encode transaction data
             const data = this.contractInterface.encodeFunctionData(functionName, inputs);
             
             // 2. Prepare transaction object
             const transaction = {
                 to: contractAddress,
                 data: data,
                 // We rely on the node to simulate with 'from' address or default
             };
             
             // 3. Call debug_traceCall
             this.errorHandler.log(`Attempting debug_traceCall for ${functionName} at ${contractAddress}`);
             const trace = await this.stateCollector.traceCall(transaction);
             
             // 4. Process Trace
             if (trace) {
                 const traceData = {
                     hash: `sim_${Date.now()}`,
                     to: contractAddress,
                     from: "0x0000000000000000000000000000000000000000", // Simulation caller
                     structLogs: trace.structLogs || trace, // Adapters might return different formats
                 };
                 
                 // processTraceData returns a snapshot
                 const snapshot = this.stateCollector.processTraceData(traceData);
                 
                 // Update context info
                 snapshot.contextInfo = {
                     type: "simulation_trace",
                     function: functionName,
                     inputs
                 };

                 // Extract gasUsed from the trace result (RPC format typically returns it)
                 // NOTE: debug_traceCall format varies by client (Geth/Hardhat/Foundry).
                 // Standard Geth returns 'gas' or 'gasUsed' at top level.
                 const gasUsed = trace.gas || trace.gasUsed || (trace.result ? trace.result.gasUsed : undefined);

                 return { 
                     stateChanges: snapshot.changes, 
                     newState: this.stateCollector.getCurrentState(),
                     gasUsed: typeof gasUsed === 'string' ? parseInt(gasUsed, 16) : gasUsed,
                     trace: trace 
                 };
             }
          } catch (traceError) {
              this.errorHandler.warn(`Runtime simulation failed, falling back to manual: ${traceError}`, "TRACE_ERROR");
              // Continue to fallback...
          }
      }
      
      // FALLBACK: Manual
      const lowerName = functionName.toLowerCase();
      if (lowerName === "transfer" || lowerName === "transferfrom") {
        stateChanges = this.simulateTransfer(functionName, inputs, newState);
      } else if (lowerName.includes("mint")) {
        stateChanges = this.simulateMint(functionName, inputs, newState);
      } else if (functionName.toLowerCase().includes("burn")) {
        stateChanges = this.simulateBurn(functionName, inputs, newState);
      } else if (functionName.toLowerCase().startsWith("set")) {
        stateChanges = this.simulateSetter(functionName, inputs, newState);
      } else if (functionName.toLowerCase().includes("approve")) {
        stateChanges = this.simulateApprove(functionName, inputs, newState);
      } else {
        stateChanges = this.simulateGenericFunction(functionName, inputs, newState);
      }

      // Track function execution
      this.functionHistory.push({
        functionName,
        inputs,
        timestamp: Date.now(),
      });

      if (stateChanges.length > 0) {
        const snapshot: StateSnapshot = {
          id: Date.now(),
          timestamp: Date.now(),
          changes: stateChanges,
          contextInfo: {
            type: "simulation",
            function: functionName,
            inputs,
          },
        };
        this.stateCollector.addSimulatedSnapshot(snapshot);
      }

      return { stateChanges, newState };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const message = `Error simulating function ${functionName}: ${err.message}`;
      this.errorHandler.handleError("SIMULATION_ERROR", message, "", err);
      return { stateChanges: [], newState: currentState };
    }
  }

  /**
   * Specialized transfer simulator
   */
  private simulateTransfer(_functionName: string, inputs: any[], newState: Record<string, any>): StateChange[] {
    const stateChanges: StateChange[] = []

    if (inputs.length < 2) {
      this.errorHandler.warn("Transfer requires at least 2 inputs (to, amount)", "TRANSFER_SIMULATION")
      return stateChanges
    }

    const to = inputs[0]
    const amount = inputs[1]

    // Find balance variable
    const fromBalance = this.findBalanceVariable(newState, "balance")
    if (!fromBalance) {
      this.errorHandler.warn("Balance variable not found in state", "TRANSFER_SIMULATION")
      return stateChanges
    }

    try {
      // Decrease sender balance
      const oldFromValue = newState[fromBalance].value
      const newFromValue = this.subtractValues(oldFromValue, amount)

      stateChanges.push({
        slot: newState[fromBalance].slot || "0x0",
        oldValue: oldFromValue,
        newValue: newFromValue,
        variableName: fromBalance,
        typeInfo: newState[fromBalance].type,
        operation: "TRANSFER_FROM",
        pc: 0,
        depth: 0,
      })

      newState[fromBalance] = {
        ...newState[fromBalance],
        value: newFromValue,
        displayValue: newFromValue,
      }

      // Increase receiver balance if exists in state
      const toBalance = `${this.formatAddress(to)}_balance`
      if (newState[toBalance]) {
        const oldToValue = newState[toBalance].value
        const newToValue = this.addValues(oldToValue, amount)

        stateChanges.push({
          slot: newState[toBalance].slot || "0x0",
          oldValue: oldToValue,
          newValue: newToValue,
          variableName: toBalance,
          typeInfo: newState[toBalance].type,
          operation: "TRANSFER_TO",
          pc: 0,
          depth: 0,
        })

        newState[toBalance] = {
          ...newState[toBalance],
          value: newToValue,
          displayValue: newToValue,
        }
      }
    } catch (error) {
      this.errorHandler.warn(`Error simulating transfer: ${error}`, "TRANSFER_ERROR")
    }

    return stateChanges
  }

  /**
   * Specialized mint simulator
   */
  private simulateMint(_functionName: string, inputs: any[], newState: Record<string, any>): StateChange[] {
    const stateChanges: StateChange[] = []

    if (inputs.length < 1) {
      this.errorHandler.warn("Mint requires at least 1 input (amount)", "MINT_SIMULATION")
      return stateChanges
    }

    const amount = inputs[0]

    try {
      // Find and update total supply
      const totalSupply = this.findVariable(newState, "totalSupply")
      if (totalSupply) {
        const oldValue = newState[totalSupply].value
        const newValue = this.addValues(oldValue, amount)

        stateChanges.push({
          slot: newState[totalSupply].slot || "0x0",
          oldValue,
          newValue,
          variableName: totalSupply,
          typeInfo: newState[totalSupply].type,
          operation: "MINT",
          pc: 0,
          depth: 0,
        })

        newState[totalSupply] = {
          ...newState[totalSupply],
          value: newValue,
          displayValue: newValue,
        }
      }
    } catch (error) {
      this.errorHandler.warn(`Error simulating mint: ${error}`, "MINT_ERROR")
    }

    return stateChanges
  }

  /**
   * Specialized burn simulator
   */
  private simulateBurn(_functionName: string, inputs: any[], newState: Record<string, any>): StateChange[] {
    const stateChanges: StateChange[] = []

    if (inputs.length < 1) {
      this.errorHandler.warn("Burn requires at least 1 input (amount)", "BURN_SIMULATION")
      return stateChanges
    }

    const amount = inputs[0]

    try {
      const totalSupply = this.findVariable(newState, "totalSupply")
      if (totalSupply) {
        const oldValue = newState[totalSupply].value
        const newValue = this.subtractValues(oldValue, amount)

        stateChanges.push({
          slot: newState[totalSupply].slot || "0x0",
          oldValue,
          newValue,
          variableName: totalSupply,
          typeInfo: newState[totalSupply].type,
          operation: "BURN",
          pc: 0,
          depth: 0,
        })

        newState[totalSupply] = {
          ...newState[totalSupply],
          value: newValue,
          displayValue: newValue,
        }
      }
    } catch (error) {
      this.errorHandler.warn(`Error simulating burn: ${error}`, "BURN_ERROR")
    }

    return stateChanges
  }

  /**
   * Specialized approve simulator
   */
  private simulateApprove(_functionName: string, inputs: any[], newState: Record<string, any>): StateChange[] {
    const stateChanges: StateChange[] = []

    if (inputs.length < 2) {
      this.errorHandler.warn("Approve requires at least 2 inputs (spender, amount)", "APPROVE_SIMULATION")
      return stateChanges
    }

    try {
      const spender = inputs[0]
      const amount = inputs[1]

      // Find or create allowance variable
      const allowanceKey = `allowance_${this.formatAddress(spender)}`
      if (newState[allowanceKey]) {
        const oldValue = newState[allowanceKey].value
        const newValue = this.formatValue(amount)

        stateChanges.push({
          slot: newState[allowanceKey].slot || "0x0",
          oldValue,
          newValue,
          variableName: allowanceKey,
          typeInfo: "Number (uint256)",
          operation: "APPROVE",
          pc: 0,
          depth: 0,
        })

        newState[allowanceKey] = {
          ...newState[allowanceKey],
          value: newValue,
          displayValue: newValue,
        }
      }
    } catch (error) {
      this.errorHandler.warn(`Error simulating approve: ${error}`, "APPROVE_ERROR")
    }

    return stateChanges
  }

  /**
   * Specialized setter simulator
   */
  private simulateSetter(functionName: string, inputs: any[], newState: Record<string, any>): StateChange[] {
    const stateChanges: StateChange[] = []

    if (inputs.length < 1) {
      this.errorHandler.warn("Setter requires at least 1 input", "SETTER_SIMULATION")
      return stateChanges
    }

    try {
      const variableName = functionName.slice(3).toLowerCase()
      const value = inputs[0]

      const variable = this.findVariable(newState, variableName)
      if (variable) {
        const oldValue = newState[variable].value
        const newValue = this.formatValue(value)

        stateChanges.push({
          slot: newState[variable].slot || "0x0",
          oldValue,
          newValue,
          variableName: variable,
          typeInfo: newState[variable].type,
          operation: "SET",
          pc: 0,
          depth: 0,
        })

        newState[variable] = {
          ...newState[variable],
          value: newValue,
          displayValue: newValue,
        }
      }
    } catch (error) {
      this.errorHandler.warn(`Error simulating setter: ${error}`, "SETTER_ERROR")
    }

    return stateChanges
  }

  /**
   * Generic function simulator as fallback
   */
  private simulateGenericFunction(functionName: string, _inputs: any[], newState: Record<string, any>): StateChange[] {
    const stateChanges: StateChange[] = []

    try {
      const variable = this.findAnyStateVariable(newState)
      if (variable && newState[variable]) {
        const oldValue = newState[variable].value
        const newValue = this.simulateStateChange(oldValue)

        stateChanges.push({
          slot: newState[variable].slot || "0x0",
          oldValue,
          newValue,
          variableName: variable,
          typeInfo: newState[variable].type,
          operation: functionName.toUpperCase(),
          pc: 0,
          depth: 0,
        })

        newState[variable] = {
          ...newState[variable],
          value: newValue,
          displayValue: newValue,
        }
      }
    } catch (error) {
      this.errorHandler.warn(`Error simulating generic function: ${error}`, "GENERIC_SIMULATION_ERROR")
    }

    return stateChanges
  }

  /**
   * Helper: find balance variable in state
   */
  private findBalanceVariable(state: Record<string, any>, keyword: string): string | null {
    for (const key of Object.keys(state)) {
      if (key.toLowerCase().includes(keyword)) {
        return key
      }
    }
    return null
  }

  /**
   * Helper: find variable by name
   */
  private findVariable(state: Record<string, any>, name: string): string | null {
    const lowerName = name.toLowerCase()

    for (const key of Object.keys(state)) {
      if (key.toLowerCase() === lowerName || key.toLowerCase().includes(lowerName)) {
        return key
      }
    }
    return null
  }

  /**
   * Helper: find any state variable
   */
  private findAnyStateVariable(state: Record<string, any>): string | null {
    for (const key of Object.keys(state)) {
      if (!key.toLowerCase().includes("constant") && !key.toLowerCase().includes("immutable")) {
        return key
      }
    }
    return Object.keys(state)[0] || null
  }

  /**
   * Helper: add values safely
   */
  private addValues(a: string, b: any): string {
    try {
      const bigA = ethers.BigNumber.from(a)
      const bigB = ethers.BigNumber.from(b.toString())
      return bigA.add(bigB).toHexString()
    } catch (error) {
      this.errorHandler.warn(`Error adding values: ${error}`, "VALUE_OPERATION")
      return a
    }
  }

  /**
   * Helper: subtract values safely
   */
  private subtractValues(a: string, b: any): string {
    try {
      const bigA = ethers.BigNumber.from(a)
      const bigB = ethers.BigNumber.from(b.toString())
      return bigA.sub(bigB).toHexString()
    } catch (error) {
      this.errorHandler.warn(`Error subtracting values: ${error}`, "VALUE_OPERATION")
      return a
    }
  }

  /**
   * Helper: format value to hex string
   */
  private formatValue(value: any): string {
    try {
      if (typeof value === "string" && value.startsWith("0x")) {
        return value
      }
      return ethers.utils.hexlify(value)
    } catch (error) {
      return value.toString()
    }
  }

  /**
   * Helper: format address
   */
  private formatAddress(addr: any): string {
    try {
      if (typeof addr === "string" && addr.startsWith("0x")) {
        return addr.toLowerCase()
      }
      return ethers.utils.getAddress(addr)
    } catch (error) {
      return String(addr)
    }
  }

  /**
   * Helper: simulate generic state change
   */
  private simulateStateChange(currentValue: string): string {
    try {
      const bigValue = ethers.BigNumber.from(currentValue)
      return bigValue.add(1).toHexString()
    } catch (error) {
      return currentValue
    }
  }

  /**
   * Get function execution history for debugging
   */
  public getFunctionHistory() {
    return [...this.functionHistory]
  }

  /**
   * Clear execution history
   */
  public clearFunctionHistory() {
    this.functionHistory = []
  }
}
