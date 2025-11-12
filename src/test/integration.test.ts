import { describe, it, expect, beforeEach } from "vitest"
import { ErrorHandler } from "../utils/errorHandler"
import { ValidationService } from "../utils/validation"

/**
 * Integration tests for core systems working together
 */
describe("Integration Tests", () => {
  let errorHandler: ErrorHandler
  let validationService: ValidationService

  beforeEach(() => {
    errorHandler = new ErrorHandler()
    validationService = new ValidationService()
  })

  describe("Error Handling with Validation", () => {
    it("should handle validation errors properly", () => {
      const validation = validationService.validateEthereumAddress("invalid")

      if (!validation.valid) {
        errorHandler.handleError("VALIDATION_ERROR", validation.error || "Validation failed")
      }

      const logs = errorHandler.getErrorLog("VALIDATION_ERROR")
      expect(logs.length).toBeGreaterThan(0)
    })

    it("should track multiple validation failures", () => {
      const addresses = ["", "0x123", "invalid", "0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG"]

      let validationFailures = 0

      addresses.forEach((addr) => {
        const result = validationService.validateEthereumAddress(addr)
        if (!result.valid) {
          validationFailures++
          errorHandler.handleError("INVALID_ADDRESS", result.error || "Invalid address")
        }
      })

      expect(validationFailures).toBe(4)
      const logs = errorHandler.getErrorLog("INVALID_ADDRESS")
      expect(logs.length).toBe(4)
    })
  })

  describe("Validation across function types", () => {
    it("should validate address inputs for functions", () => {
      const testCases = [
        {
          input: "0x1234567890123456789012345678901234567890",
          type: "address",
          expected: true,
        },
        { input: "invalid", type: "address", expected: false },
        { input: "123", type: "uint256", expected: true },
        { input: "abc", type: "uint256", expected: false },
        { input: "true", type: "bool", expected: true },
        { input: "invalid", type: "bool", expected: false },
      ]

      const results = testCases.map((tc) => {
        const result = validationService.validateFunctionInput(tc.input, tc.type)
        return { ...tc, actual: result.valid }
      })

      results.forEach((r) => {
        if (r.actual !== r.expected) {
          errorHandler.handleError("VALIDATION_MISMATCH", `Expected ${r.expected} for ${r.input}`)
        }
      })

      // All validations should match expected
      const validationMismatches = errorHandler.getErrorLog("VALIDATION_MISMATCH")
      expect(validationMismatches).toHaveLength(0)
    })
  })

  describe("Error recovery workflow", () => {
    it("should provide error context for recovery", () => {
      const testError = new Error("Test error")
      const context = errorHandler.handleError("TEST", "Test message", "Details", testError)

      expect(context.code).toBe("TEST")
      expect(context.message).toBe("Test message")
      expect(context.details).toBe("Details")
      expect(context.stack).toBe(testError.stack)
      expect(context.timestamp).toBeDefined()
    })

    it("should allow error history inspection", () => {
      errorHandler.handleError("CODE1", "First error")
      errorHandler.handleError("CODE1", "Second error")
      errorHandler.handleError("CODE2", "Different error")

      const code1Logs = errorHandler.getErrorLog("CODE1")
      const code2Logs = errorHandler.getErrorLog("CODE2")

      expect(code1Logs).toHaveLength(2)
      expect(code2Logs).toHaveLength(1)

      const lastError = errorHandler.getLastError("CODE1")
      expect(lastError?.message).toBe("Second error")
    })
  })

  describe("Comprehensive validation pipeline", () => {
    it("should validate multiple inputs sequentially", () => {
      const inputs = [
        { value: "0x1234567890123456789012345678901234567890", type: "address" },
        { value: "100", type: "uint256" },
        { value: "true", type: "bool" },
        { value: "0x1234567890123456789012345678901234567890abcd1234567890", type: "bytes32" },
      ]

      const validatedInputs = inputs.map((input) => {
        const result = validationService.validateFunctionInput(input.value, input.type)
        if (!result.valid) {
          errorHandler.handleError("INPUT_VALIDATION_FAILED", result.error || "Input validation failed")
        }
        return result.valid
      })

      const allValid = validatedInputs.every((v) => v)
      expect(allValid).toBe(true)
      expect(errorHandler.getErrorLog("INPUT_VALIDATION_FAILED")).toHaveLength(0)
    })
  })
})
