export interface OpcodeStats {
  sloadCount: number
  sstoreCount: number
  callCount: number
  delegateCallCount: number
  staticCallCount: number
  logCount: number
  createCount: number
  selfDestructCount: number
  memoryOpsCount: number // MLOAD, MSTORE
  cryptoOpsCount: number // SHA3, etc.
  totalOpcodes: number
}

export class BytecodeAnalyzer {
  /**
   * Analyzes EVM bytecode (hex string) and returns opcode statistics.
   * Smartly skips PUSH data to avoid false positives.
   */
  public analyze(bytecode: string): OpcodeStats {
    const stats: OpcodeStats = {
      sloadCount: 0,
      sstoreCount: 0,
      callCount: 0,
      delegateCallCount: 0,
      staticCallCount: 0,
      logCount: 0,
      createCount: 0,
      selfDestructCount: 0,
      memoryOpsCount: 0,
      cryptoOpsCount: 0,
      totalOpcodes: 0,
    }

    // Strip 0x prefix and constructor args (if this were deployment bytecode, but we assume runtime for now or mixed)
    // For simplicity, we just strip 0x and iterate.
    const cleanBytecode = bytecode.startsWith("0x") ? bytecode.slice(2) : bytecode

    // Bytecode is hex, so 2 chars per byte
    let pc = 0
    while (pc < cleanBytecode.length / 2) {
      const byte = Number.parseInt(cleanBytecode.substr(pc * 2, 2), 16)
      
      // Determine opcode
      // Ref: https://www.evm.codes/
      
      // Update stats
      stats.totalOpcodes++

      if (byte === 0x54) stats.sloadCount++         // SLOAD
      else if (byte === 0x55) stats.sstoreCount++   // SSTORE
      else if (byte === 0xf1) stats.callCount++     // CALL
      else if (byte === 0xf2) stats.callCount++     // CALLCODE (Deprecated but counts)
      else if (byte === 0xf4) stats.delegateCallCount++ // DELEGATECALL
      else if (byte === 0xfa) stats.staticCallCount++   // STATICCALL
      else if (byte >= 0xa0 && byte <= 0xa4) stats.logCount++ // LOG0 - LOG4
      else if (byte === 0xf0) stats.createCount++   // CREATE
      else if (byte === 0xf5) stats.createCount++   // CREATE2
      else if (byte === 0xff) stats.selfDestructCount++ // SELFDESTRUCT
      else if (byte === 0x51 || byte === 0x52 || byte === 0x53) stats.memoryOpsCount++ // MLOAD, MSTORE, MSTORE8
      else if (byte === 0x20) stats.cryptoOpsCount++ // SHA3 (KECCAK256)

      // Handle PUSH instructions (0x60 - 0x7F)
      // PUSH1 (0x60) consumes next 1 byte, PUSH32 (0x7f) consumes next 32 bytes
      if (byte >= 0x60 && byte <= 0x7f) {
        const bytesToSkip = byte - 0x5f // 0x60 is PUSH1 -> skip 1
        pc += bytesToSkip
      }

      pc++
    }

    return stats
  }

  public estimateBaseGas(stats: OpcodeStats): number {
    let gas = 21000 // Transaction base cost

    // Very rough static analysis estimates (Runtime costs are dynamic)
    gas += stats.sstoreCount * 20000 // Pessimistic (new slot)
    gas += stats.sloadCount * 2100   // Cold access
    gas += stats.callCount * 2600    // Base call cost (ignoring value transfer)
    gas += stats.logCount * 1000     // Rough log cost
    gas += stats.createCount * 32000
    gas += stats.cryptoOpsCount * 30 // SHA3 base

    return gas
  }
}
