/**
 * Service for validating user inputs
 */
export class ValidationService {
  /**
   * Validate Ethereum address format
   */
  validateEthereumAddress(value: string): { valid: boolean; error?: string } {
    if (!value) {
      return { valid: false, error: "Address cannot be empty" };
    }

    if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
      return {
        valid: false,
        error:
          "Invalid Ethereum address format (must be 0x followed by 40 hex characters)",
      };
    }

    return { valid: true };
  }

  /**
   * Validate transaction hash format
   */
  validateTransactionHash(value: string): { valid: boolean; error?: string } {
    if (!value) {
      return { valid: false, error: "Transaction hash cannot be empty" };
    }

    if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
      return {
        valid: false,
        error:
          "Invalid transaction hash format (must be 0x followed by 64 hex characters)",
      };
    }

    return { valid: true };
  }

  /**
   * Validate contract address is not a zero address
   */
  validateNotZeroAddress(address: string): { valid: boolean; error?: string } {
    if (address === "0x0000000000000000000000000000000000000000") {
      return { valid: false, error: "Cannot use zero address" };
    }

    return { valid: true };
  }

  /**
   * Validate function inputs based on type
   */
  validateFunctionInput(
    value: string,
    type: string
  ): { valid: boolean; error?: string } {
    if (!value) {
      return { valid: false, error: "Input cannot be empty" };
    }

    if (type.includes("uint")) {
      if (!/^\d+$/.test(value)) {
        return { valid: false, error: "Must be a valid unsigned integer" };
      }
    } else if (type === "address") {
      return this.validateEthereumAddress(value);
    } else if (type === "bool") {
      if (!["true", "false", "0", "1"].includes(value.toLowerCase())) {
        return { valid: false, error: "Must be true, false, 0, or 1" };
      }
    }

    return { valid: true };
  }
}
