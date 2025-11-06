import { describe, it, expect } from "vitest"
import { ValidationService } from "../utils/validation"

describe("ValidationService", () => {
  let validator: ValidationService

  beforeEach(() => {
    validator = new ValidationService()
  })

  describe("validateEthereumAddress", () => {
    it("should accept valid addresses", () => {
      const result = validator.validateEthereumAddress("0x1234567890123456789012345678901234567890")
      expect(result.valid).toBe(true)
    })

    it("should reject empty addresses", () => {
      const result = validator.validateEthereumAddress("")
      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    it("should reject invalid format", () => {
      const result = validator.validateEthereumAddress("0x123")
      expect(result.valid).toBe(false)
    })

    it("should reject non-hex characters", () => {
      const result = validator.validateEthereumAddress("0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG")
      expect(result.valid).toBe(false)
    })

    it("should be case insensitive", () => {
      const result = validator.validateEthereumAddress("0x1234567890abcDEF1234567890abcDEF12345678")
      expect(result.valid).toBe(true)
    })
  })

  describe("validateTransactionHash", () => {
    it("should accept valid hashes", () => {
      const result = validator.validateTransactionHash(
        "0x1234567890123456789012345678901234567890123456789012345678901234",
      )
      expect(result.valid).toBe(true)
    })

    it("should reject short hashes", () => {
      const result = validator.validateTransactionHash("0x123")
      expect(result.valid).toBe(false)
    })

    it("should reject empty hashes", () => {
      const result = validator.validateTransactionHash("")
      expect(result.valid).toBe(false)
    })
  })

  describe("validateNotZeroAddress", () => {
    it("should accept non-zero addresses", () => {
      const result = validator.validateNotZeroAddress("0x1234567890123456789012345678901234567890")
      expect(result.valid).toBe(true)
    })

    it("should reject zero address", () => {
      const result = validator.validateNotZeroAddress("0x0000000000000000000000000000000000000000")
      expect(result.valid).toBe(false)
    })
  })

  describe("validateFunctionInput", () => {
    it("should validate unsigned integers", () => {
      const result = validator.validateFunctionInput("123", "uint256")
      expect(result.valid).toBe(true)
    })

    it("should reject non-numeric inputs for uint", () => {
      const result = validator.validateFunctionInput("abc", "uint256")
      expect(result.valid).toBe(false)
    })

    it("should validate addresses", () => {
      const result = validator.validateFunctionInput("0x1234567890123456789012345678901234567890", "address")
      expect(result.valid).toBe(true)
    })

    it("should validate booleans", () => {
      expect(validator.validateFunctionInput("true", "bool").valid).toBe(true)
      expect(validator.validateFunctionInput("false", "bool").valid).toBe(true)
      expect(validator.validateFunctionInput("0", "bool").valid).toBe(true)
      expect(validator.validateFunctionInput("1", "bool").valid).toBe(true)
      expect(validator.validateFunctionInput("maybe", "bool").valid).toBe(false)
    })

    it("should reject empty inputs", () => {
      const result = validator.validateFunctionInput("", "uint256")
      expect(result.valid).toBe(false)
    })
  })
})
