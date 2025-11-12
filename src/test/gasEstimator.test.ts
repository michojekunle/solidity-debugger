import { describe, it, expect, beforeEach } from "vitest"
import { GasEstimator } from "../core/gasAnalyzer/gasEstimator"

describe("GasEstimator", () => {
  let estimator: GasEstimator

  beforeEach(() => {
    estimator = new GasEstimator()
  })

  describe("processTransactionTrace", () => {
    it("should handle invalid trace data", () => {
      expect(() => estimator.processTransactionTrace(null)).not.toThrow()
      expect(() => estimator.processTransactionTrace({})).not.toThrow()
      expect(estimator.getGasUsage()).toHaveLength(0)
    })

    it("should extract gas usage from trace", () => {
      const trace = {
        result: { gasUsed: 50000 },
        input: "0xa9059cbb0000000000000000000000001234567890123456789012345678901234567890",
        structLogs: [],
      }

      estimator.processTransactionTrace(trace)
      const usage = estimator.getGasUsage()

      expect(usage).toHaveLength(1)
      expect(usage[0].gasUsed).toBe(50000)
    })

    it("should analyze opcodes correctly", () => {
      const trace = {
        result: { gasUsed: 100000 },
        input: "0xa9059cbb",
        structLogs: [{ op: "SLOAD" }, { op: "SLOAD" }, { op: "SSTORE" }, { op: "SSTORE" }, { op: "CALL" }],
      }

      estimator.processTransactionTrace(trace)
      const usage = estimator.getGasUsage()[0]

      expect(usage.sloadCount).toBe(2)
      expect(usage.sstoreCount).toBe(2)
      expect(usage.callCount).toBe(1)
    })

    it("should generate recommendations based on gas usage", () => {
      const trace = {
        result: { gasUsed: 600000 },
        input: "0xa9059cbb",
        structLogs: [],
      }

      estimator.processTransactionTrace(trace)
      const usage = estimator.getGasUsage()[0]

      expect(usage.recommendations.length).toBeGreaterThan(0)
      expect(usage.recommendations[0]).toContain("High gas usage")
    })

    it("should recommend SLOAD caching", () => {
      const logs = Array(25)
        .fill(null)
        .map(() => ({ op: "SLOAD" }))

      const trace = {
        result: { gasUsed: 100000 },
        input: "0x",
        structLogs: logs,
      }

      estimator.processTransactionTrace(trace)
      const usage = estimator.getGasUsage()[0]

      expect(usage.recommendations.some((r) => r.includes("SLOAD"))).toBe(true)
    })

    it("should recommend SSTORE batching", () => {
      const logs = Array(15)
        .fill(null)
        .map(() => ({ op: "SSTORE" }))

      const trace = {
        result: { gasUsed: 200000 },
        input: "0x",
        structLogs: logs,
      }

      estimator.processTransactionTrace(trace)
      const usage = estimator.getGasUsage()[0]

      expect(usage.recommendations.some((r) => r.includes("SSTORE"))).toBe(true)
    })
  })

  describe("getGasUsage", () => {
    it("should return empty array initially", () => {
      expect(estimator.getGasUsage()).toEqual([])
    })

    it("should return gas usage for functions", () => {
      const trace1 = {
        result: { gasUsed: 50000 },
        input: "0xa9059cbb",
        structLogs: [],
      }

      const trace2 = {
        result: { gasUsed: 75000 },
        input: "0x40c10f19",
        structLogs: [],
      }

      estimator.processTransactionTrace(trace1)
      estimator.processTransactionTrace(trace2)

      const usage = estimator.getGasUsage()
      expect(usage).toHaveLength(2)
    })
  })

  describe("getGasUsageForFunction", () => {
    it("should return gas usage for specific function", () => {
      const trace = {
        result: { gasUsed: 50000 },
        input: "0xa9059cbb",
        structLogs: [],
      }

      estimator.processTransactionTrace(trace)
      const usage = estimator.getGasUsageForFunction("transfer")

      expect(usage).toBeDefined()
      expect(usage?.gasUsed).toBe(50000)
    })

    it("should return undefined for unknown function", () => {
      const usage = estimator.getGasUsageForFunction("unknown")
      expect(usage).toBeUndefined()
    })
  })

  describe("clearGasUsage", () => {
    it("should clear all gas usage data", () => {
      const trace = {
        result: { gasUsed: 50000 },
        input: "0xa9059cbb",
        structLogs: [],
      }

      estimator.processTransactionTrace(trace)
      expect(estimator.getGasUsage()).toHaveLength(1)

      estimator.clearGasUsage()
      expect(estimator.getGasUsage()).toHaveLength(0)
    })
  })

  describe("dispose", () => {
    it("should dispose resources", () => {
      expect(() => estimator.dispose()).not.toThrow()
    })
  })
})
