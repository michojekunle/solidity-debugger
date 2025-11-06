import * as ethers from "ethers"
import { ErrorHandler } from "../../utils/errorHandler"
import type { StateCollector, StateChange, StateSnapshot } from "./stateCollector"

/**
 * Enhanced contract simulator with better state tracking and function routing
 */
export class ContractSimulator {
  private contractAbi: any[] = []
  private contractInterface: ethers.utils.Interface | null = null
  private stateCollector: StateCollector
  private errorHandler = new ErrorHandler()
  private functionHistory: Array<{ functionName: string; inputs: any[]; timestamp: number }> = []

  constructor(stateCollector: StateCollector) {
    this.stateCollector = stateCollector
  }

  /**
   * Set the contract ABI for simulation
   */
  public setContractAbi(abi: any[]) {
    try {
      if (!Array.isArray(abi) || abi.length === 0) {
        this.errorHandler.warn("Empty or invalid ABI provided", "ABI_VALIDATION")
        return
      }

      this.contractAbi = abi
      this.contractInterface = new ethers.utils.Interface(abi)
      this.errorHandler.log("Contract interface initialized for simulation")
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      this.errorHandler.handleError("ABI_INIT_ERROR", "Error initializing contract interface", "", err)
      this.contractInterface = null
    }
  }

  /**
   * Get all available functions from the contract ABI
   */
  public getContractFunctions() {
    if (!this.contractAbi || this.contractAbi.length === 0) {
      return []
    }

    return this.contractAbi
      .filter((item) => item.type === "function")
      .map((func) => ({
        name: func.name,
        inputs: func.inputs || [],
        outputs: func.outputs || [],
        stateMutability: func.stateMutability || "nonpayable",
      }))
  }

  /**
   * Added comprehensive function simulation with better routing
   */
  public simulateFunction(
    functionName: string,
    inputs: any[],
    currentState: Record<string, any>,
  ): { stateChanges: StateChange[]; newState: Record<string, any> } {
    try {
      if (!functionName || typeof functionName !== "string") {
        throw new Error("Invalid function name provided")
      }

      if (!Array.isArray(inputs)) {
        throw new Error("Inputs must be an array")
      }

      if (!currentState || typeof currentState !== "object") {
        throw new Error("Current state must be a valid object")
      }

      this.errorHandler.log(`Simulating function ${functionName} with ${inputs.length} inputs`)

      if (!this.contractInterface) {
        this.errorHandler.warn("Contract interface not initialized", "SIMULATION_ERROR")
        return { stateChanges: [], newState: currentState }
      }

      // Find the function in the ABI
      const funcFragment = this.contractInterface.getFunction(functionName)
      if (!funcFragment) {
        throw new Error(`Function ${functionName} not found in ABI`)
      }

      // Check if function modifies state
      if (funcFragment.stateMutability === "view" || funcFragment.stateMutability === "pure") {
        this.errorHandler.log(`Function ${functionName} is view/pure, no state changes`)
        return { stateChanges: [], newState: currentState }
      }

      const newState = { ...currentState }
      let stateChanges: StateChange[] = []

      // Route to appropriate simulator
      if (functionName.toLowerCase().includes("transfer")) {
        stateChanges = this.simulateTransfer(functionName, inputs, newState)
      } else if (functionName.toLowerCase().includes("mint")) {
        stateChanges = this.simulateMint(functionName, inputs, newState)
      } else if (functionName.toLowerCase().includes("burn")) {
        stateChanges = this.simulateBurn(functionName, inputs, newState)
      } else if (functionName.toLowerCase().startsWith("set")) {
        stateChanges = this.simulateSetter(functionName, inputs, newState)
      } else if (functionName.toLowerCase().includes("approve")) {
        stateChanges = this.simulateApprove(functionName, inputs, newState)
      } else {
        stateChanges = this.simulateGenericFunction(functionName, inputs, newState)
      }

      // Track function execution
      this.functionHistory.push({
        functionName,
        inputs,
        timestamp: Date.now(),
      })

      // Create and add snapshot if there were changes
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
        }

        this.stateCollector.addSimulatedSnapshot(snapshot)
      }

      return { stateChanges, newState }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      const message = `Error simulating function ${functionName}: ${err.message}`
      this.errorHandler.handleError("SIMULATION_ERROR", message, "", err)
      return { stateChanges: [], newState: currentState }
    }
  }

  /**
   * Specialized transfer simulator
   */
  private simulateTransfer(functionName: string, inputs: any[], newState: Record<string, any>): StateChange[] {
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
  private simulateMint(functionName: string, inputs: any[], newState: Record<string, any>): StateChange[] {
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
  private simulateBurn(functionName: string, inputs: any[], newState: Record<string, any>): StateChange[] {
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
  private simulateApprove(functionName: string, inputs: any[], newState: Record<string, any>): StateChange[] {
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
  private simulateGenericFunction(functionName: string, inputs: any[], newState: Record<string, any>): StateChange[] {
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
