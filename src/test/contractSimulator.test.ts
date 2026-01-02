import { describe, it, expect, beforeEach, vi } from "vitest"
import { ContractSimulator } from "../core/stateProcessor/contractSimulator"
import type { StateCollector } from "../core/stateProcessor/stateCollector"

// Mock StateCollector
const createMockStateCollector = (): StateCollector =>
  ({
    addSimulatedSnapshot: vi.fn(),
    getSnapshots: vi.fn(() => []),
    getCurrentState: vi.fn(() => ({})),
    dispose: vi.fn(),
    getCurrentContractAddress: vi.fn(() => null),
    isReady: vi.fn(() => false),
    traceCall: vi.fn(),
    processTraceData: vi.fn(),
  }) as any

describe("ContractSimulator", () => {
  let simulator: ContractSimulator
  let mockStateCollector: StateCollector

  beforeEach(() => {
    mockStateCollector = createMockStateCollector()
    simulator = new ContractSimulator(mockStateCollector)
  })

  describe("getContractFunctions", () => {
    it("should return empty array when no ABI is set", () => {
      const functions = simulator.getContractFunctions()
      expect(functions).toEqual([])
    })

    it("should extract functions from ABI", () => {
      const abi = [
        {
          type: "function",
          name: "transfer",
          inputs: [{ name: "to", type: "address" }],
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
      ]

      simulator.setContractAbi(abi)
      const functions = simulator.getContractFunctions()

      expect(functions).toHaveLength(2)
      expect(functions[0].name).toBe("transfer")
      expect(functions[1].name).toBe("balanceOf")
    })
  })

  describe("simulateFunction", () => {
    beforeEach(() => {
      const abi = [
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
          name: "transferOwnership",
          inputs: [{ name: "newOwner", type: "address" }],
          outputs: [],
          stateMutability: "nonpayable",
        },
      ]

      simulator.setContractAbi(abi)
    })

    it("should handle invalid function names", async () => {
      const state = { balance: { value: "0x100", type: "uint256", slot: "0x0" } }
      const result = await simulator.simulateFunction("nonexistent", [], state)

      expect(result.stateChanges).toHaveLength(0)
      expect(result.newState).toEqual(state)
    })

    it("should not modify state for view functions", async () => {
      const state = { balance: { value: "0x100", type: "uint256", slot: "0x0" } }
      const result = await simulator.simulateFunction("balanceOf", ["0x123"], state)

      expect(result.stateChanges).toHaveLength(0)
      expect(result.newState).toEqual(state)
    })

    it("should simulate transfer correctly", async () => {
      const state = {
        balance: {
          value: "0x100",
          type: "uint256",
          slot: "0x0",
          displayValue: "256",
        },
      }

      const result = await simulator.simulateFunction(
        "transfer",
        ["0x1234567890123456789012345678901234567890", "0x50"],
        state,
      )

      expect(result.stateChanges.length).toBeGreaterThan(0)
      expect(result.newState.balance.value).not.toBe(state.balance.value)
    })

    it("should use traceCall when contract is deployed", async () => {
      // Setup mock for trace simulation
      const mockTrace = { structLogs: [] };
      const mockSnapshot = { 
          id: 1, 
          timestamp: 123, 
          changes: [{ slot: "0x1", newValue: "0x1", oldValue: "0x0" }] 
      };
      
      mockStateCollector.getCurrentContractAddress = vi.fn(() => "0x1234567890123456789012345678901234567890");
      mockStateCollector.isReady = vi.fn(() => true);
      mockStateCollector.traceCall = vi.fn().mockResolvedValue(mockTrace);
      mockStateCollector.processTraceData = vi.fn().mockReturnValue(mockSnapshot);
      mockStateCollector.getCurrentState = vi.fn(() => ({}));
      
      const result = await simulator.simulateFunction("transfer", ["0x1234567890123456789012345678901234567890", "100"], {});
      
      expect(mockStateCollector.traceCall).toHaveBeenCalled();
      expect(mockStateCollector.processTraceData).toHaveBeenCalled();
      expect(result.stateChanges).toEqual(mockSnapshot.changes);
    });

    it("should handle transferOwnership correctly (not as ERC20 transfer)", async () => {
      // Logic for transferOwnership (1 input) should not trigger "Transfer requires at least 2 inputs"
      const state = { owner: { value: "0x123", type: "address", slot: "0x0" } };
      
      // Override isReady to false to force fallback simulation
      mockStateCollector.isReady = vi.fn(() => false);

      const result = await simulator.simulateFunction(
        "transferOwnership",
        ["0x456"],
        state
      );

      // Expect successful simulation (fallback to generic)
      expect(result.stateChanges.length).toBeGreaterThan(0);
      // Generic simulation simply increments the value found
      expect(result.stateChanges[0].variableName).toBe("owner");
    });

    it("should fallback to manual simulation if traceCall fails", async () => {
      mockStateCollector.getCurrentContractAddress = vi.fn(() => "0x1234567890123456789012345678901234567890");
      mockStateCollector.isReady = vi.fn(() => true);
      mockStateCollector.traceCall = vi.fn().mockRejectedValue(new Error("RPC Error"));
      
      // Setup state for manual fallback
      const state = {
        balance: {
          value: "0x100",
          type: "uint256",
          slot: "0x0",
          displayValue: "256",
        },
      }
      mockStateCollector.getCurrentState = vi.fn(() => state);

      const result = await simulator.simulateFunction("transfer", ["0x1234567890123456789012345678901234567890", "0x50"], state);
      
      expect(mockStateCollector.traceCall).toHaveBeenCalled();
      // Should still produce changes via manual fallback
      expect(result.stateChanges.length).toBeGreaterThan(0);
    });

    it("should track function execution history", async () => {
      await simulator.simulateFunction("transfer", ["0x123", "100"], {
        balance: { value: "0x100", type: "uint256", slot: "0x0" },
      })

      const history = simulator.getFunctionHistory()
      expect(history).toHaveLength(1)
      expect(history[0].functionName).toBe("transfer")
      expect(history[0].inputs).toEqual(["0x123", "100"])
    })

    it("should clear function history", async () => {
      await simulator.simulateFunction("transfer", ["0x123", "100"], {
        balance: { value: "0x100", type: "uint256", slot: "0x0" },
      })

      simulator.clearFunctionHistory()
      expect(simulator.getFunctionHistory()).toHaveLength(0)
    })
  })

  describe("setContractAbi", () => {
    it("should handle invalid ABI gracefully", () => {
      expect(() => simulator.setContractAbi([])).not.toThrow()
      expect(simulator.getContractFunctions()).toHaveLength(0)
    })

    it("should initialize contract interface with valid ABI", () => {
      const abi = [
        {
          type: "function",
          name: "test",
          inputs: [],
          outputs: [],
          stateMutability: "nonpayable",
        },
      ]

      simulator.setContractAbi(abi)
      expect(simulator.getContractFunctions()).toHaveLength(1)
    })
  })
})
