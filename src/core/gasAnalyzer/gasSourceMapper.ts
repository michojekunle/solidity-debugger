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
    
    // Opcodes lookup table (partial - expand as needed)
    const opcodeTable: Record<string, string> = {
      '00': 'STOP', '01': 'ADD', '02': 'MUL', '03': 'SUB', '04': 'DIV',
      '10': 'LT', '11': 'GT', '12': 'SLT', '13': 'SGT', '14': 'EQ',
      '50': 'POP', '51': 'MLOAD', '52': 'MSTORE', '53': 'MSTORE8',
      '54': 'SLOAD', '55': 'SSTORE', '56': 'JUMP', '57': 'JUMPI',
      'F0': 'CREATE', 'F1': 'CALL', 'F2': 'CALLCODE', 'F3': 'RETURN',
      'F4': 'DELEGATECALL', 'FA': 'STATICCALL', 'FD': 'REVERT', 'FF': 'SELFDESTRUCT'
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
   * Get gas costs for common opcodes
   */
  private getOpcodeGasCosts(): Record<string, number> {
    return {
      'STOP': 0,
      'ADD': 3, 'MUL': 5, 'SUB': 3, 'DIV': 5, 'MOD': 5,
      'LT': 3, 'GT': 3, 'EQ': 3,
      'POP': 2, 'MLOAD': 3, 'MSTORE': 3, 'MSTORE8': 3,
      'SLOAD': 2100, // Warm SLOAD (cold is 2100, warm is 100 post-Berlin)
      'SSTORE': 20000, // New storage slot (5000 for existing)
      'JUMP': 8, 'JUMPI': 10,
      'CALL': 700, // Base cost (not including value transfer or new account)
      'DELEGATECALL': 700,
      'STATICCALL': 700,
      'CREATE': 32000,
      'SELFDESTRUCT': 5000,
      'RETURN': 0,
      'REVERT': 0
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
    
    if (opString.includes('SLOAD,SLOAD')) {
      return 'repeated-sload';
    }
    if (opString.includes('SSTORE') && opcodes.length > 5) {
      return 'storage-in-loop';
    }
    if (opString.match(/SLOAD.*SLOAD.*SLOAD/)) {
      return 'multiple-sload';
    }
    
    return undefined;
  }

  /**
   * Generate optimization recommendation
   */
  private generateRecommendation(hotspot: GasHotspot): string {
    const { opcodes, pattern, gasUsed } = hotspot;

    if (pattern === 'repeated-sload') {
      return `Repeated SLOAD operations detected (${gasUsed} gas). Consider caching the storage value in a memory variable.`;
    }
    if (pattern === 'storage-in-loop') {
      return `Storage write in loop detected (${gasUsed} gas). Consider accumulating changes and writing once after the loop.`;
    }
    if (pattern === 'multiple-sload') {
      return `Multiple SLOAD operations (${gasUsed} gas). Cache frequently accessed storage variables in memory.`;
    }
    if (opcodes.includes('SSTORE')) {
      return `Storage write operation (${gasUsed} gas). Consider if this variable needs to be stored or can be computed.`;
    }
    if (opcodes.includes('SLOAD')) {
      return `Storage read operation (${gasUsed} gas). If accessed multiple times, cache in memory.`;
    }
    if (opcodes.includes('CALL') || opcodes.includes('DELEGATECALL')) {
      return `External call detected (${gasUsed} gas). Ensure this is necessary and gas limits are appropriate.`;
    }

    return `Gas usage: ${gasUsed}. Review if this operation can be optimized.`;
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
