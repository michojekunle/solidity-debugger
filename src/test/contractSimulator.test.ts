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
      ]

      simulator.setContractAbi(abi)
    })

    it("should handle invalid function names", () => {
      const state = { balance: { value: "0x100", type: "uint256", slot: "0x0" } }
      const result = simulator.simulateFunction("nonexistent", [], state)

      expect(result.stateChanges).toHaveLength(0)
      expect(result.newState).toEqual(state)
    })

    it("should not modify state for view functions", () => {
      const state = { balance: { value: "0x100", type: "uint256", slot: "0x0" } }
      const result = simulator.simulateFunction("balanceOf", ["0x123"], state)

      expect(result.stateChanges).toHaveLength(0)
      expect(result.newState).toEqual(state)
    })

    it("should simulate transfer correctly", () => {
      const state = {
        balance: {
          value: "0x100",
          type: "uint256",
          slot: "0x0",
          displayValue: "256",
        },
      }

      const result = simulator.simulateFunction(
        "transfer",
        ["0x1234567890123456789012345678901234567890", "0x50"],
        state,
      )

      expect(result.stateChanges.length).toBeGreaterThan(0)
      expect(result.newState.balance.value).not.toBe(state.balance.value)
    })

    it("should track function execution history", () => {
      simulator.simulateFunction("transfer", ["0x123", "100"], {
        balance: { value: "0x100", type: "uint256", slot: "0x0" },
      })

      const history = simulator.getFunctionHistory()
      expect(history).toHaveLength(1)
      expect(history[0].functionName).toBe("transfer")
      expect(history[0].inputs).toEqual(["0x123", "100"])
    })

    it("should clear function history", () => {
      simulator.simulateFunction("transfer", ["0x123", "100"], {
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
