import * as ethers from "ethers";
import type {
  StateCollector,
  StateChange,
  StateSnapshot,
} from "./stateCollector";

/**
 * Service for simulating contract execution and state changes
 */
export class ContractSimulator {
  private contractAbi: any[] = [];
  private contractInterface: ethers.utils.Interface | null = null;
  private stateCollector: StateCollector;

  constructor(stateCollector: StateCollector) {
    this.stateCollector = stateCollector;
  }

  /**
   * Set the contract ABI for simulation
   */
  public setContractAbi(abi: any[]) {
    this.contractAbi = abi;
    try {
      this.contractInterface = new ethers.utils.Interface(abi);
      console.log("Contract interface initialized for simulation");
    } catch (error) {
      console.error("Error initializing contract interface:", error);
      this.contractInterface = null;
    }
  }

  /**
   * Get all available functions from the contract ABI
   */
  public getContractFunctions() {
    if (!this.contractAbi) {
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
   * Simulate execution of a contract function
   */
  public simulateFunction(
    functionName: string,
    inputs: any[],
    currentState: Record<string, any>
  ): { stateChanges: StateChange[]; newState: Record<string, any> } {
    console.log(`Simulating function ${functionName} with inputs:`, inputs);

    if (!this.contractInterface) {
      console.error("Contract interface not initialized");
      return { stateChanges: [], newState: currentState };
    }

    try {
      // Find the function in the ABI
      const funcFragment = this.contractInterface.getFunction(functionName);
      if (!funcFragment) {
        console.error(`Function ${functionName} not found in ABI`);
        return { stateChanges: [], newState: currentState };
      }

      // Create a copy of the current state to modify
      const newState = { ...currentState };
      const stateChanges: StateChange[] = [];

      // Simulate the function execution based on its type and inputs
      if (
        funcFragment.stateMutability === "view" ||
        funcFragment.stateMutability === "pure"
      ) {
        // View/pure functions don't change state
        console.log(`Function ${functionName} is view/pure, no state changes`);
        return { stateChanges, newState };
      }

      // For state-changing functions, we need to simulate the state changes
      // This is a simplified simulation - in a real implementation, you would
      // use a proper EVM simulator or call a node with eth_call

      // For demonstration, we'll implement some common patterns:

      // Example: transfer function
      if (
        functionName.toLowerCase().includes("transfer") &&
        inputs.length >= 2
      ) {
        const to = inputs[0];
        const amount = inputs[1];

        // Find balance variables
        const fromBalance = this.findBalanceVariable(currentState, "balance");
        const toBalance = `${to}_balance`;

        if (fromBalance) {
          // Decrease sender balance
          const oldValue = newState[fromBalance].value;
          const newValue = this.subtractValues(oldValue, amount);

          stateChanges.push({
            slot: newState[fromBalance].slot || "0x0",
            oldValue,
            newValue,
            variableName: fromBalance,
            typeInfo: newState[fromBalance].type,
            operation: "TRANSFER_FROM",
            pc: 0,
            depth: 0,
          });

          newState[fromBalance] = {
            ...newState[fromBalance],
            value: newValue,
            displayValue: newValue,
          };

          // Increase receiver balance (if it exists in our state)
          if (newState[toBalance]) {
            const oldToValue = newState[toBalance].value;
            const newToValue = this.addValues(oldToValue, amount);

            stateChanges.push({
              slot: newState[toBalance].slot || "0x0",
              oldValue: oldToValue,
              newValue: newToValue,
              variableName: toBalance,
              typeInfo: newState[toBalance].type,
              operation: "TRANSFER_TO",
              pc: 0,
              depth: 0,
            });

            newState[toBalance] = {
              ...newState[toBalance],
              value: newToValue,
              displayValue: newToValue,
            };
          }
        }
      }

      // Example: mint function
      else if (
        functionName.toLowerCase().includes("mint") &&
        inputs.length >= 1
      ) {
        const amount = inputs[0];

        // Find total supply variable
        const totalSupply = this.findVariable(currentState, "totalSupply");

        if (totalSupply) {
          // Increase total supply
          const oldValue = newState[totalSupply].value;
          const newValue = this.addValues(oldValue, amount);

          stateChanges.push({
            slot: newState[totalSupply].slot || "0x0",
            oldValue,
            newValue,
            variableName: totalSupply,
            typeInfo: newState[totalSupply].type,
            operation: "MINT",
            pc: 0,
            depth: 0,
          });

          newState[totalSupply] = {
            ...newState[totalSupply],
            value: newValue,
            displayValue: newValue,
          };
        }
      }

      // Example: burn function
      else if (
        functionName.toLowerCase().includes("burn") &&
        inputs.length >= 1
      ) {
        const amount = inputs[0];

        // Find total supply variable
        const totalSupply = this.findVariable(currentState, "totalSupply");

        if (totalSupply) {
          // Decrease total supply
          const oldValue = newState[totalSupply].value;
          const newValue = this.subtractValues(oldValue, amount);

          stateChanges.push({
            slot: newState[totalSupply].slot || "0x0",
            oldValue,
            newValue,
            variableName: totalSupply,
            typeInfo: newState[totalSupply].type,
            operation: "BURN",
            pc: 0,
            depth: 0,
          });

          newState[totalSupply] = {
            ...newState[totalSupply],
            value: newValue,
            displayValue: newValue,
          };
        }
      }

      // Example: set functions (setName, setSymbol, etc.)
      else if (
        functionName.toLowerCase().startsWith("set") &&
        inputs.length >= 1
      ) {
        const variableName = functionName.slice(3).toLowerCase();
        const value = inputs[0];

        // Find the variable
        const variable = this.findVariable(currentState, variableName);

        if (variable) {
          const oldValue = newState[variable].value;
          const newValue = this.formatValue(value);

          stateChanges.push({
            slot: newState[variable].slot || "0x0",
            oldValue,
            newValue,
            variableName: variable,
            typeInfo: newState[variable].type,
            operation: "SET",
            pc: 0,
            depth: 0,
          });

          newState[variable] = {
            ...newState[variable],
            value: newValue,
            displayValue: newValue,
          };
        }
      }

      // For other functions, we'll just create a generic state change
      // In a real implementation, you would analyze the function and simulate its effects
      else {
        // Find a variable that might be affected (for demonstration)
        const variable = this.findAnyStateVariable(currentState);

        if (variable) {
          const oldValue = newState[variable].value;
          const newValue = this.simulateGenericStateChange(oldValue);

          stateChanges.push({
            slot: newState[variable].slot || "0x0",
            oldValue,
            newValue,
            variableName: variable,
            typeInfo: newState[variable].type,
            operation: functionName.toUpperCase(),
            pc: 0,
            depth: 0,
          });

          newState[variable] = {
            ...newState[variable],
            value: newValue,
            displayValue: newValue,
          };
        }
      }

      // Create a snapshot for this simulation
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

        // Add the snapshot to the state collector
        this.stateCollector.addSimulatedSnapshot(snapshot);
      }

      return { stateChanges, newState };
    } catch (error) {
      console.error(`Error simulating function ${functionName}:`, error);
      return { stateChanges: [], newState: currentState };
    }
  }

  /**
   * Helper method to find a balance variable in the state
   */
  private findBalanceVariable(
    state: Record<string, any>,
    keyword: string
  ): string | null {
    for (const key of Object.keys(state)) {
      if (key.toLowerCase().includes(keyword)) {
        return key;
      }
    }
    return null;
  }

  /**
   * Helper method to find a variable by name in the state
   */
  private findVariable(
    state: Record<string, any>,
    name: string
  ): string | null {
    const lowerName = name.toLowerCase();

    for (const key of Object.keys(state)) {
      if (
        key.toLowerCase() === lowerName ||
        key.toLowerCase().includes(lowerName)
      ) {
        return key;
      }
    }
    return null;
  }

  /**
   * Helper method to find any state variable that can be modified
   */
  private findAnyStateVariable(state: Record<string, any>): string | null {
    // Prefer non-constant variables
    for (const key of Object.keys(state)) {
      if (
        !key.toLowerCase().includes("constant") &&
        !key.toLowerCase().includes("immutable")
      ) {
        return key;
      }
    }

    // If no non-constant variables, return the first one
    return Object.keys(state)[0] || null;
  }

  /**
   * Helper method to add values (handling hex and decimal)
   */
  private addValues(a: string, b: any): string {
    try {
      const bigA = ethers.BigNumber.from(a);
      const bigB = ethers.BigNumber.from(b.toString());
      return bigA.add(bigB).toHexString();
    } catch (error) {
      console.error("Error adding values:", error);
      return a;
    }
  }

  /**
   * Helper method to subtract values (handling hex and decimal)
   */
  private subtractValues(a: string, b: any): string {
    try {
      const bigA = ethers.BigNumber.from(a);
      const bigB = ethers.BigNumber.from(b.toString());
      return bigA.sub(bigB).toHexString();
    } catch (error) {
      console.error("Error subtracting values:", error);
      return a;
    }
  }

  /**
   * Helper method to format a value to hex string
   */
  private formatValue(value: any): string {
    try {
      if (typeof value === "string" && value.startsWith("0x")) {
        return value;
      }
      return ethers.utils.hexlify(value);
    } catch (error) {
      console.error("Error formatting value:", error);
      return value.toString();
    }
  }

  /**
   * Simulate a generic state change for demonstration
   */
  private simulateGenericStateChange(currentValue: string): string {
    try {
      // For demonstration, we'll just increment the value
      const bigValue = ethers.BigNumber.from(currentValue);
      return bigValue.add(1).toHexString();
    } catch (error) {
      console.error("Error simulating generic state change:", error);
      return currentValue;
    }
  }
}
