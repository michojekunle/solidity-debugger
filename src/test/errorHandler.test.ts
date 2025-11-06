import { describe, it, expect, beforeEach } from "vitest"
import { ErrorHandler } from "../utils/errorHandler"
import { vi } from "vitest"

describe("ErrorHandler", () => {
  let errorHandler: ErrorHandler

  beforeEach(() => {
    errorHandler = new ErrorHandler()
  })

  describe("handleError", () => {
    it("should log errors with context", () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

      const context = errorHandler.handleError("TEST_ERROR", "Test message", "Test details")

      expect(context.code).toBe("TEST_ERROR")
      expect(context.message).toBe("Test message")
      expect(context.details).toBe("Test details")
      expect(context.timestamp).toBeDefined()
      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })

    it("should store error logs", () => {
      errorHandler.handleError("CODE1", "Message 1")
      errorHandler.handleError("CODE1", "Message 2")

      const logs = errorHandler.getErrorLog("CODE1")
      expect(logs).toHaveLength(2)
    })

    it("should prevent memory leaks by limiting log size", () => {
      // Add more than max logs
      for (let i = 0; i < 150; i++) {
        errorHandler.handleError("SPAM", `Message ${i}`)
      }

      const logs = errorHandler.getErrorLog("SPAM")
      expect(logs.length).toBeLessThanOrEqual(100)
    })

    it("should handle initialization errors", () => {
      const error = new Error("Init failed")
      const context = errorHandler.handleInitializationError("Failed to init", error)

      expect(context.code).toBe("INIT_ERROR")
      expect(context.stack).toBe(error.stack)
    })

    it("should get last error", () => {
      errorHandler.handleError("CODE", "First")
      errorHandler.handleError("CODE", "Second")

      const lastError = errorHandler.getLastError("CODE")
      expect(lastError?.message).toBe("Second")
    })

    it("should clear error logs", () => {
      errorHandler.handleError("CODE1", "Message 1")
      errorHandler.handleError("CODE2", "Message 2")

      errorHandler.clearErrorLog("CODE1")
      expect(errorHandler.getErrorLog("CODE1")).toHaveLength(0)
      expect(errorHandler.getErrorLog("CODE2")).toHaveLength(1)

      errorHandler.clearErrorLog()
      expect(errorHandler.getErrorReport()).toEqual({})
    })

    it("should generate error report", () => {
      errorHandler.handleError("CODE1", "Message 1")
      errorHandler.handleError("CODE2", "Message 2")

      const report = errorHandler.getErrorReport()
      expect(Object.keys(report)).toContain("CODE1")
      expect(Object.keys(report)).toContain("CODE2")
    })
  })

  describe("warn", () => {
    it("should warn without throwing", () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

      expect(() => errorHandler.warn("Warning message")).not.toThrow()
      expect(consoleWarnSpy).toHaveBeenCalled()

      consoleWarnSpy.mockRestore()
    })
  })
})
