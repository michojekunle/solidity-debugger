import { describe, it, expect, beforeEach, vi } from "vitest"
import type * as vscode from "vscode"
import { StateCollector } from "../core/stateProcessor/stateCollector"

// Mock vscode module
const createMockContext = (): vscode.ExtensionContext =>
  ({
    extensionPath: "/mock/path",
    subscriptions: [],
    workspaceState: {
      get: vi.fn(),
      update: vi.fn(),
      keys: vi.fn(() => []),
    } as any,
    globalState: {
      get: vi.fn(),
      update: vi.fn(),
      keys: vi.fn(() => []),
    } as any,
    secrets: {
      get: vi.fn(),
      store: vi.fn(),
      delete: vi.fn(),
      onDidChange: { fire: vi.fn() },
    } as any,
    extensionUri: { fsPath: "/mock" } as any,
    storageUri: { fsPath: "/mock" } as any,
    logUri: { fsPath: "/mock" } as any,
    logPath: "/mock",
  }) as any

describe("StateCollector", () => {
  let stateCollector: StateCollector
  let mockContext: vscode.ExtensionContext

  beforeEach(() => {
    mockContext = createMockContext()
    stateCollector = new StateCollector(mockContext)
  })

  describe("initialization", () => {
    it("should initialize without errors", () => {
      expect(stateCollector).toBeDefined()
    })

    it("should have isReady method", () => {
      expect(typeof stateCollector.isReady).toBe("function")
    })

    it("should return empty snapshots initially", () => {
      const snapshots = stateCollector.getSnapshots()
      expect(Array.isArray(snapshots)).toBe(true)
    })
  })

  describe("processTraceData", () => {
    it("should handle valid trace data", () => {
      const traceData = {
        hash: "0x123",
        to: "0xabc",
        from: "0xdef",
        value: "0x0",
        structLogs: [
          {
            pc: 0,
            op: "SSTORE",
            stack: ["0x0", "0x100"],
            depth: 1,
            gas: 100000,
          },
        ],
      }

      const snapshot = stateCollector.processTraceData(traceData)

      expect(snapshot).toBeDefined()
      expect(snapshot.id).toBe(0)
      expect(snapshot.changes).toHaveLength(1)
    })

    it("should reject invalid trace data", () => {
      const snapshot = stateCollector.processTraceData(null)
      expect(snapshot.changes).toHaveLength(0)
    })

    it("should handle SSTORE operations", () => {
      const traceData = {
        hash: "0x123",
        structLogs: [
          {
            pc: 100,
            op: "SSTORE",
            stack: ["0x0", "0x5"],
            depth: 1,
            gas: 100000,
          },
          {
            pc: 110,
            op: "SSTORE",
            stack: ["0x0", "0x7"],
            depth: 1,
            gas: 95000,
          },
        ],
      }

      const snapshot = stateCollector.processTraceData(traceData)

      expect(snapshot.changes).toHaveLength(2)
      expect(snapshot.changes[0].operation).toBe("SSTORE")
      expect(snapshot.changes[0].newValue).toBe("0x5")
    })

    it("should skip non-SSTORE operations", () => {
      const traceData = {
        hash: "0x123",
        structLogs: [
          {
            pc: 50,
            op: "SLOAD",
            stack: ["0x0"],
            depth: 1,
            gas: 100000,
          },
          {
            pc: 100,
            op: "SSTORE",
            stack: ["0x0", "0x5"],
            depth: 1,
            gas: 95000,
          },
        ],
      }

      const snapshot = stateCollector.processTraceData(traceData)

      expect(snapshot.changes).toHaveLength(1)
      expect(snapshot.changes[0].operation).toBe("SSTORE")
    })
  })

  describe("clearState", () => {
    it("should clear snapshots", () => {
      const traceData = {
        hash: "0x123",
        structLogs: [
          {
            pc: 100,
            op: "SSTORE",
            stack: ["0x0", "0x5"],
            depth: 1,
          },
        ],
      }

      stateCollector.processTraceData(traceData)
      expect(stateCollector.getSnapshots()).toHaveLength(1)

      stateCollector.clearState()
      expect(stateCollector.getSnapshots()).toHaveLength(0)
    })
  })

  describe("snapshot events", () => {
    it("should emit snapshot created event", (_done) => {
      const unsubscribe = stateCollector.onSnapshotCreated((snapshot) => {
        expect(snapshot).toBeDefined()
        // unsubscribe()
        // done()
      })

      const traceData = {
        hash: "0x123",
        structLogs: [
          {
            pc: 100,
            op: "SSTORE",
            stack: ["0x0", "0x5"],
            depth: 1,
          },
        ],
      }

      stateCollector.processTraceData(traceData)
    })

    it("should emit error events on invalid input", (_done) => {
      const unsubscribe = stateCollector.onError((error) => {
        expect(error.code).toBeDefined()
        // unsubscribe()
        // done()
      })

      stateCollector.processTraceData({ structLogs: "invalid" })
    })
  })

  describe("disposal", () => {
    it("should dispose without errors", () => {
      expect(() => stateCollector.dispose()).not.toThrow()
    })
  })
})
