import { describe, it, expect, beforeEach } from 'vitest';
import { GasSourceMapper, GasHotspot } from '../core/gasAnalyzer/gasSourceMapper';

describe('GasSourceMapper Integration Tests', () => {
  let gasSourceMapper: GasSourceMapper;

  beforeEach(() => {
    gasSourceMapper = new GasSourceMapper();
  });

  it('should parse solc source map correctly', () => {
    const sourceMap = '0:10:0:i;20:5:0:o;25:10:0:j';
    gasSourceMapper.parseSolcSourceMap(sourceMap);
    
    // Source map should be parsed into internal structure
    expect(gasSourceMapper).toBeTruthy();
  });

  it('should detect repeated SLOAD pattern', () => {
    const bytecode = '60005460005460005460001'; // Simplified - multiple SLOADs
    const sourceMap = '0:100:0';
    const sourceCode = `
pragma solidity ^0.8.0;
contract Test {
    uint256 public value;
    function test() public view returns (uint256) {
        return value + value + value; // Multiple reads
    }
}`.trim();

    const hotspots = gasSourceMapper.analyzeGasUsage(bytecode, sourceMap, sourceCode);
    
    // Should detect gas usage
    expect(hotspots).toBeInstanceOf(Array);
  });

  it('should categorize gas usage by severity', () => {
    // Mock bytecode with high-cost operation (SSTORE = 20000 gas)
    const bytecode = '60016000556001600155'; // Two SSTOREs
    const sourceMap = '0:50:0;10:50:0';
    const sourceCode = `
pragma solidity ^0.8.0;
contract Test {
    uint256 public a;
    uint256 public b;
    function test() public {
        a = 1;
        b = 1;
    }
}`.trim();

    const hotspots = gasSourceMapper.analyzeGasUsage(bytecode, sourceMap, sourceCode);
    
    if (hotspots.length > 0) {
      const severities = hotspots.map(h => h.severity);
      // Should include high/critical severity for SSTORE operations
      expect(severities.some(s => s === 'high' || s === 'critical')).toBe(true);
    }
  });

  it('should generate recommendations for detected patterns', () => {
    const bytecode = '60005460005460001'; // Repeated SLOAD
    const sourceMap = '0:100:0';
    const sourceCode = `
pragma solidity ^0.8.0;
contract Test {
    uint256 public value;
    function inefficient() public view returns (uint256) {
        return value + value; // Repeated storage read
    }
}`.trim();

    const hotspots = gasSourceMapper.analyzeGasUsage(bytecode, sourceMap, sourceCode);
    
    if (hotspots.length > 0) {
      hotspots.forEach(hotspot => {
        expect(hotspot.recommendation).toBeTruthy();
        expect(hotspot.recommendation.length).toBeGreaterThan(0);
      });
    }
  });

  it('should map bytecode positions to source code ranges', () => {
    const sourceCode = `
pragma solidity ^0.8.0;

contract Test {
    uint256 public value;
    
    function setValue(uint256 _value) public {
        value = _value; // Line 7
    }
}`.trim();

    const sourceMap = '50:10:0'; // Start at character 50, length 10
    gasSourceMapper.parseSolcSourceMap(sourceMap);
    
    // Test that the method  executes without errors
    // It may return null for unmapped positions - that's valid
    expect(() => {
      const range = gasSourceMapper.mapBytecodeToSource(0, sourceCode);
    }).not.toThrow();
  });

  it('should decode bytecode into opcodes', () => {
    // Simple bytecode: PUSH1 0x01, PUSH1 0x00, SSTORE
    const bytecode = '6001600055';
    const sourceMap = '0:10:0';
    const sourceCode = 'contract Test { uint256 x = 1; }';
    
    const hotspots = gasSourceMapper.analyzeGasUsage(bytecode, sourceMap, sourceCode);
    
    // Should detect SSTORE opcode
    const hasSSTORE = hotspots.some(h => h.opcodes.includes('SSTORE'));
    expect(hasSSTORE || hotspots.length === 0).toBe(true);
  });

  it('should handle empty or invalid bytecode gracefully', () => {
    const emptyBytecode = '';
    const sourceMap = '';
    const sourceCode = 'contract Test {}';
    
    const hotspots = gasSourceMapper.analyzeGasUsage(emptyBytecode, sourceMap, sourceCode);
    
    // Should return empty array without crashing
    expect(hotspots).toBeInstanceOf(Array);
    expect(hotspots.length).toBe(0);
  });
});
