import * as vscode from "vscode";

/**
 * Represents a gas-intensive code location with optimization recommendations
 */
export interface GasHotspot {
  location: vscode.Range;
  gasUsed: number;
  severity: 'optimal' | 'warning' | 'high' | 'critical';
  opcodes: string[];
  recommendation: string;
  suggestedFix?: string;
  pattern?: string; // e.g., "repeated-sload", "storage-in-loop"
}

/**
 * Maps bytecode gas costs back to source code locations
 */
export class GasSourceMapper {
  private sourceMap: string = '';
  private sourceMappings: Array<{ start: number; length: number; fileIndex: number; jump: string }> = [];

  /**
   * Parse solc source map format
   * Format: "s:l:f:j;s:l:f:j;..." where s=start, l=length, f=file, j=jump
   */
  public parseSolcSourceMap(sourceMap: string): void {
    this.sourceMap = sourceMap;
    this.sourceMappings = [];

    const mappings = sourceMap.split(';');
    let lastMapping = { start: 0, length: 0, fileIndex: 0, jump: '-' };

    for (const mapping of mappings) {
      if (!mapping) {
        // Empty mapping inherits from previous
        this.sourceMappings.push({ ...lastMapping });
        continue;
      }

      const parts = mapping.split(':');
      const newMapping = {
        start: parts[0] ? parseInt(parts[0], 10) : lastMapping.start,
        length: parts[1] ? parseInt(parts[1], 10) : lastMapping.length,
        fileIndex: parts[2] ? parseInt(parts[2], 10) : lastMapping.fileIndex,
        jump: parts[3] || lastMapping.jump
      };

      this.sourceMappings.push(newMapping);
      lastMapping = newMapping;
    }
  }

  /**
   * Map bytecode position to source code position
   */
  public mapBytecodeToSource(bytecodeOffset: number, sourceCode: string): vscode.Range | null {
    if (bytecodeOffset >= this.sourceMappings.length) {
      return null;
    }

    const mapping = this.sourceMappings[bytecodeOffset];
    if (!mapping || mapping.start === -1) {
      return null;
    }

    const startPos = this.offsetToPosition(sourceCode, mapping.start);
    const endPos = this.offsetToPosition(sourceCode, mapping.start + mapping.length);

    return new vscode.Range(startPos, endPos);
  }

  /**
   * Analyze bytecode and create gas hotspots
   */
  public analyzeGasUsage(
    bytecode: string,
    sourceMap: string,
    sourceCode: string,
    runtimeTrace?: any
  ): GasHotspot[] {
    this.parseSolcSourceMap(sourceMap);
    const hotspots: Map<string, GasHotspot> = new Map();

    // Analyze static bytecode opcodes
    const opcodes = this.decodeBytecode(bytecode);
    const gasTable = this.getOpcodeGasCosts();

    let totalGasEstimate = 0;
    opcodes.forEach((opcode, index) => {
      const gasCost = gasTable[opcode.name] || 0;
      if (gasCost === 0) return;

      totalGasEstimate += gasCost;
      const range = this.mapBytecodeToSource(index, sourceCode);
      if (!range) return;

      const rangeKey = `${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`;
      
      if (hotspots.has(rangeKey)) {
        // Accumulate gas for same location
        const existing = hotspots.get(rangeKey)!;
        existing.gasUsed += gasCost;
        existing.opcodes.push(opcode.name);
      } else {
        hotspots.set(rangeKey, {
          location: range,
          gasUsed: gasCost,
          opcodes: [opcode.name],
          severity: this.calculateSeverity(gasCost),
          recommendation: '',
          pattern: this.detectPattern([opcode.name])
        });
      }
    });

    // Enhance with runtime trace data if available
    if (runtimeTrace?.structLogs) {
      this.enhanceWithRuntimeData(hotspots, runtimeTrace.structLogs, sourceCode);
    }

    // Generate recommendations
    const hotspotsArray = Array.from(hotspots.values());
    hotspotsArray.forEach(hotspot => {
      hotspot.recommendation = this.generateRecommendation(hotspot);
      hotspot.severity = this.calculateSeverity(hotspot.gasUsed);
      if (hotspot.pattern) {
        hotspot.suggestedFix = this.generateFix(hotspot.pattern, hotspot.location, sourceCode);
      }
    });

    return hotspotsArray.sort((a, b) => b.gasUsed - a.gasUsed);
  }

  /**
   * Decode bytecode into opcodes
   */
  private decodeBytecode(bytecode: string): Array<{ name: string; offset: number }> {
    const opcodes: Array<{ name: string; offset: number }> = [];
    const bytes = bytecode.startsWith('0x') ? bytecode.slice(2) : bytecode;
    
    // Complete EVM opcode lookup table
    const opcodeTable: Record<string, string> = {
      // Stop and Arithmetic Operations
      '00': 'STOP', '01': 'ADD', '02': 'MUL', '03': 'SUB', '04': 'DIV',
      '05': 'SDIV', '06': 'MOD', '07': 'SMOD', '08': 'ADDMOD', '09': 'MULMOD',
      '0A': 'EXP', '0B': 'SIGNEXTEND',
      // Comparison & Bitwise Logic
      '10': 'LT', '11': 'GT', '12': 'SLT', '13': 'SGT', '14': 'EQ',
      '15': 'ISZERO', '16': 'AND', '17': 'OR', '18': 'XOR', '19': 'NOT',
      '1A': 'BYTE', '1B': 'SHL', '1C': 'SHR', '1D': 'SAR',
      // SHA3
      '20': 'SHA3',
      // Environmental Information
      '30': 'ADDRESS', '31': 'BALANCE', '32': 'ORIGIN', '33': 'CALLER',
      '34': 'CALLVALUE', '35': 'CALLDATALOAD', '36': 'CALLDATASIZE',
      '37': 'CALLDATACOPY', '38': 'CODESIZE', '39': 'CODECOPY',
      '3A': 'GASPRICE', '3B': 'EXTCODESIZE', '3C': 'EXTCODECOPY',
      '3D': 'RETURNDATASIZE', '3E': 'RETURNDATACOPY', '3F': 'EXTCODEHASH',
      // Block Information
      '40': 'BLOCKHASH', '41': 'COINBASE', '42': 'TIMESTAMP', '43': 'NUMBER',
      '44': 'DIFFICULTY', '45': 'GASLIMIT', '46': 'CHAINID', '47': 'SELFBALANCE',
      '48': 'BASEFEE',
      // Stack, Memory, Storage and Flow
      '50': 'POP', '51': 'MLOAD', '52': 'MSTORE', '53': 'MSTORE8',
      '54': 'SLOAD', '55': 'SSTORE', '56': 'JUMP', '57': 'JUMPI',
      '58': 'PC', '59': 'MSIZE', '5A': 'GAS', '5B': 'JUMPDEST',
      // Push Operations (0x60 - 0x7F)
      '60': 'PUSH1', '61': 'PUSH2', '62': 'PUSH3', '63': 'PUSH4',
      '64': 'PUSH5', '65': 'PUSH6', '66': 'PUSH7', '67': 'PUSH8',
      '68': 'PUSH9', '69': 'PUSH10', '6A': 'PUSH11', '6B': 'PUSH12',
      '6C': 'PUSH13', '6D': 'PUSH14', '6E': 'PUSH15', '6F': 'PUSH16',
      '70': 'PUSH17', '71': 'PUSH18', '72': 'PUSH19', '73': 'PUSH20',
      '74': 'PUSH21', '75': 'PUSH22', '76': 'PUSH23', '77': 'PUSH24',
      '78': 'PUSH25', '79': 'PUSH26', '7A': 'PUSH27', '7B': 'PUSH28',
      '7C': 'PUSH29', '7D': 'PUSH30', '7E': 'PUSH31', '7F': 'PUSH32',
      // Duplication Operations (0x80 - 0x8F)
      '80': 'DUP1', '81': 'DUP2', '82': 'DUP3', '83': 'DUP4',
      '84': 'DUP5', '85': 'DUP6', '86': 'DUP7', '87': 'DUP8',
      '88': 'DUP9', '89': 'DUP10', '8A': 'DUP11', '8B': 'DUP12',
      '8C': 'DUP13', '8D': 'DUP14', '8E': 'DUP15', '8F': 'DUP16',
      // Exchange Operations (0x90 - 0x9F)
      '90': 'SWAP1', '91': 'SWAP2', '92': 'SWAP3', '93': 'SWAP4',
      '94': 'SWAP5', '95': 'SWAP6', '96': 'SWAP7', '97': 'SWAP8',
      '98': 'SWAP9', '99': 'SWAP10', '9A': 'SWAP11', '9B': 'SWAP12',
      '9C': 'SWAP13', '9D': 'SWAP14', '9E': 'SWAP15', '9F': 'SWAP16',
      // Logging Operations
      'A0': 'LOG0', 'A1': 'LOG1', 'A2': 'LOG2', 'A3': 'LOG3', 'A4': 'LOG4',
      // System Operations
      'F0': 'CREATE', 'F1': 'CALL', 'F2': 'CALLCODE', 'F3': 'RETURN',
      'F4': 'DELEGATECALL', 'F5': 'CREATE2', 'FA': 'STATICCALL',
      'FD': 'REVERT', 'FE': 'INVALID', 'FF': 'SELFDESTRUCT'
    };

    let i = 0;
    while (i < bytes.length) {
      const byte = bytes.slice(i, i + 2);
      const opcode = opcodeTable[byte.toUpperCase()] || 'UNKNOWN';
      opcodes.push({ name: opcode, offset: i / 2 });

      // Handle PUSH instructions (they have data following)
      const byteValue = parseInt(byte, 16);
      if (byteValue >= 0x60 && byteValue <= 0x7f) {
        const pushSize = byteValue - 0x5f;
        i += 2 + (pushSize * 2); // Skip the pushed data
      } else {
        i += 2;
      }
    }

    return opcodes;
  }

  /**
   * Get gas costs for all EVM opcodes
   */
  private getOpcodeGasCosts(): Record<string, number> {
    return {
      // Zero cost
      'STOP': 0, 'RETURN': 0, 'REVERT': 0, 'INVALID': 0,
      // Base tier (3 gas)
      'ADD': 3, 'SUB': 3, 'LT': 3, 'GT': 3, 'SLT': 3, 'SGT': 3, 'EQ': 3,
      'ISZERO': 3, 'AND': 3, 'OR': 3, 'XOR': 3, 'NOT': 3, 'BYTE': 3,
      'SHL': 3, 'SHR': 3, 'SAR': 3, 'CALLDATALOAD': 3, 'MLOAD': 3, 'MSTORE': 3,
      'MSTORE8': 3, 'PUSH1': 3, 'PUSH2': 3, 'PUSH3': 3, 'PUSH4': 3,
      'PUSH5': 3, 'PUSH6': 3, 'PUSH7': 3, 'PUSH8': 3, 'PUSH9': 3, 'PUSH10': 3,
      'PUSH11': 3, 'PUSH12': 3, 'PUSH13': 3, 'PUSH14': 3, 'PUSH15': 3, 'PUSH16': 3,
      'PUSH17': 3, 'PUSH18': 3, 'PUSH19': 3, 'PUSH20': 3, 'PUSH21': 3, 'PUSH22': 3,
      'PUSH23': 3, 'PUSH24': 3, 'PUSH25': 3, 'PUSH26': 3, 'PUSH27': 3, 'PUSH28': 3,
      'PUSH29': 3, 'PUSH30': 3, 'PUSH31': 3, 'PUSH32': 3,
      'DUP1': 3, 'DUP2': 3, 'DUP3': 3, 'DUP4': 3, 'DUP5': 3, 'DUP6': 3,
      'DUP7': 3, 'DUP8': 3, 'DUP9': 3, 'DUP10': 3, 'DUP11': 3, 'DUP12': 3,
      'DUP13': 3, 'DUP14': 3, 'DUP15': 3, 'DUP16': 3,
      'SWAP1': 3, 'SWAP2': 3, 'SWAP3': 3, 'SWAP4': 3, 'SWAP5': 3, 'SWAP6': 3,
      'SWAP7': 3, 'SWAP8': 3, 'SWAP9': 3, 'SWAP10': 3, 'SWAP11': 3, 'SWAP12': 3,
      'SWAP13': 3, 'SWAP14': 3, 'SWAP15': 3, 'SWAP16': 3,
      // Low tier (2-5 gas)
      'POP': 2, 'ADDRESS': 2, 'ORIGIN': 2, 'CALLER': 2, 'CALLVALUE': 2,
      'CALLDATASIZE': 2, 'CODESIZE': 2, 'GASPRICE': 2, 'COINBASE': 2,
      'TIMESTAMP': 2, 'NUMBER': 2, 'DIFFICULTY': 2, 'GASLIMIT': 2,
      'CHAINID': 2, 'SELFBALANCE': 2, 'BASEFEE': 2, 'PC': 2, 'MSIZE': 2, 'GAS': 2,
      'MUL': 5, 'DIV': 5, 'SDIV': 5, 'MOD': 5, 'SMOD': 5, 'SIGNEXTEND': 5,
      // Jump operations
      'JUMP': 8, 'JUMPI': 10, 'JUMPDEST': 1,
      // Hashing
      'SHA3': 30, // + 6 per word
      // Memory expansion
      'CALLDATACOPY': 3, 'CODECOPY': 3, 'RETURNDATACOPY': 3,
      'RETURNDATASIZE': 2,
      // External operations (expensive)
      'BALANCE': 100, // Warm access, cold is 2600
      'EXTCODESIZE': 100, // Warm access
      'EXTCODECOPY': 100, // Warm access
      'EXTCODEHASH': 100, // Warm access
      'BLOCKHASH': 20,
      // Storage operations (very expensive)
      'SLOAD': 100, // Warm access, cold is 2100
      'SSTORE': 100, // Base cost, actual varies: 20000 new, 5000 update, 200 noop
      // Logging (moderately expensive)
      'LOG0': 375, 'LOG1': 750, 'LOG2': 1125, 'LOG3': 1500, 'LOG4': 1875,
      // External calls (expensive)
      'CALL': 100, // Base cost, actual is 100 + gas_sent_with_call
      'CALLCODE': 100,
      'DELEGATECALL': 100,
      'STATICCALL': 100,
      // Contract creation (very expensive)
      'CREATE': 32000,
      'CREATE2': 32000,
      // Self-destruct
      'SELFDESTRUCT': 5000,
      // Exponentiation
      'ADDMOD': 8, 'MULMOD': 8, 'EXP': 10 // + 50 per byte in exponent
    };
  }

  /**
   * Calculate severity based on gas cost
   */
  private calculateSeverity(gasUsed: number): 'optimal' | 'warning' | 'high' | 'critical' {
    if (gasUsed < 1000) return 'optimal';
    if (gasUsed < 5000) return 'warning';
    if (gasUsed < 20000) return 'high';
    return 'critical';
  }

  /**
   * Detect common gas-wasting patterns
   */
  private detectPattern(opcodes: string[]): string | undefined {
    const opString = opcodes.join(',');
    const opCount = new Map<string, number>();
    opcodes.forEach(op => opCount.set(op, (opCount.get(op) || 0) + 1));
    
    // Storage patterns
    if ((opCount.get('SLOAD') || 0) >= 2) {
      return 'repeated-sload';
    }
    if (opString.includes('SSTORE') && opcodes.length > 5) {
      return 'storage-in-loop';
    }
    if ((opCount.get('SSTORE') || 0) >= 2) {
      return 'multiple-sstore';
    }
    
    // External call patterns
    if (opcodes.some(op => ['CALL', 'DELEGATECALL', 'STATICCALL'].includes(op))) {
      if (opString.includes('SLOAD') || opString.includes('SSTORE')) {
        return 'call-with-storage';
      }
      return 'external-call';
    }
    
    // Logging patterns
    if (opcodes.some(op => op.startsWith('LOG'))) {
      return 'logging';
    }
    
    // Creation patterns
    if (opcodes.includes('CREATE') || opcodes.includes('CREATE2')) {
      return 'contract-creation';
    }
    
    // Hash patterns
    if ((opCount.get('SHA3') || 0) >= 2) {
      return 'repeated-hashing';
    }
    
    // Memory patterns
    if ((opCount.get('MLOAD') || 0) + (opCount.get('MSTORE') || 0) > 10) {
      return 'heavy-memory';
    }
    
    // Balance check
    if (opcodes.includes('BALANCE')) {
      return 'balance-check';
    }
    
    return undefined;
  }

  /**
   * Generate optimization recommendation with specific, actionable advice
   */
  private generateRecommendation(hotspot: GasHotspot): string {
    const { opcodes, pattern, gasUsed } = hotspot;

    // Pattern-specific recommendations
    switch (pattern) {
      case 'repeated-sload':
        return `⚠️ Repeated SLOAD (${gasUsed} gas). Cache in memory: \`uint256 cached = storageVar;\` saves ~100 gas per read.`;
      
      case 'storage-in-loop':
        return `🔴 Storage write in loop (${gasUsed} gas). Accumulate in memory and write once: \`uint256 temp; for(...) temp += x; storageVar = temp;\``;
      
      case 'multiple-sstore':
        return `⚠️ Multiple SSTORE operations (${gasUsed} gas). Consider combining into a single struct write or using events for some data.`;
      
      case 'call-with-storage':
        return `🔴 External call with storage access (${gasUsed} gas). Cache storage values before the call to avoid re-entrancy issues and save gas.`;
      
      case 'external-call':
        return `⚠️ External call detected (${gasUsed} gas). Verify gas limits and consider using \`call{gas: specificAmount}()\` for predictable costs.`;
      
      case 'logging':
        return `ℹ️ Event emission (${gasUsed} gas). LOG operations are relatively cheap. Consider indexed parameters for important searchable fields.`;
      
      case 'contract-creation':
        return `🔴 Contract creation (${gasUsed} gas). This is expensive. Consider using Clone pattern (EIP-1167) or Beacon proxies for repeated deployments.`;
      
      case 'repeated-hashing':
        return `⚠️ Multiple SHA3/keccak operations (${gasUsed} gas). Pre-compute hashes for constant values or cache computed hashes.`;
      
      case 'heavy-memory':
        return `ℹ️ Heavy memory usage (${gasUsed} gas). Memory expansion is quadratic. Consider processing in smaller chunks.`;
      
      case 'balance-check':
        return `⚠️ BALANCE opcode (${gasUsed} gas). Consider using \`address(this).balance\` caching or tracking balances in storage when possible.`;
    }

    // Opcode-specific recommendations (fallback)
    if (opcodes.includes('SSTORE')) {
      return `💾 Storage write (${gasUsed} gas). New slot: 20,000 gas. Update: 5,000 gas. Consider if data must be stored on-chain.`;
    }
    if (opcodes.includes('SLOAD')) {
      return `💾 Storage read (${gasUsed} gas). Cold: 2,100 gas. Warm: 100 gas. Cache frequently accessed values in memory.`;
    }
    if (opcodes.includes('SHA3')) {
      return `#️⃣ Keccak256 hash (${gasUsed} gas + 6 per word). Use bytes32 instead of string when possible.`;
    }
    if (opcodes.includes('EXP')) {
      return `📈 Exponentiation (${gasUsed} gas). Cost scales with exponent size. Consider using bit shifts for powers of 2.`;
    }

    // Severity-based fallback
    if (gasUsed >= 5000) {
      return `🔴 High gas usage: ${gasUsed} gas. Review this operation for optimization opportunities.`;
    }
    if (gasUsed >= 1000) {
      return `⚠️ Moderate gas usage: ${gasUsed} gas. May be optimizable depending on usage frequency.`;
    }
    
    return `ℹ️ Gas usage: ${gasUsed}. This operation has standard costs.`;
  }

  /**
   * Generate suggested code fix
   */
  private generateFix(pattern: string, _location: vscode.Range, _sourceCode: string): string {
    // This would analyze the actual source code and generate a fix
    // For now, return a template suggestion
    if (pattern === 'repeated-sload') {
      return 'uint256 cachedValue = storageVariable; // Cache in memory\n// Then use cachedValue instead of repeated storage reads';
    }
    if (pattern === 'storage-in-loop') {
      return 'uint256 tempValue = 0;\nfor (...) {\n  tempValue += ...; // Accumulate\n}\nstorageVariable = tempValue; // Single write';
    }
    return '';
  }

  /**
   * Enhance hotspots with runtime trace data
   */
  private enhanceWithRuntimeData(
    hotspots: Map<string, GasHotspot>,
    structLogs: any[],
    sourceCode: string
  ): void {
    // Match runtime gas usage to source locations
    structLogs.forEach(log => {
      if (!log.pc || !log.gas) return;
      
      const range = this.mapBytecodeToSource(log.pc, sourceCode);
      if (!range) return;

      const rangeKey = `${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`;
      const hotspot = hotspots.get(rangeKey);
      
      if (hotspot && log.gasCost) {
        // Update with actual runtime cost
        hotspot.gasUsed = log.gasCost;
      }
    });
  }

  /**
   * Convert character offset to line/character position
   */
  private offsetToPosition(sourceCode: string, offset: number): vscode.Position {
    let line = 0;
    let character = 0;
    let currentOffset = 0;

    for (let i = 0; i < sourceCode.length && currentOffset < offset; i++) {
      if (sourceCode[i] === '\n') {
        line++;
        character = 0;
      } else {
        character++;
      }
      currentOffset++;
    }

    return new vscode.Position(line, character);
  }
}
