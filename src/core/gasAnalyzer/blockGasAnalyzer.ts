import * as vscode from "vscode";
import type { GasHotspot } from "./gasSourceMapper";

/**
 * Represents a code block with gas analysis
 */
export interface GasBlock {
  type: 'function' | 'loop' | 'conditional' | 'statement';
  name: string;
  location: vscode.Range;
  totalGas: number;
  lines: GasLine[];
  severity: 'optimal' | 'warning' | 'high' | 'critical';
  recommendation: string;
  children?: GasBlock[]; // Nested blocks (e.g., loops inside functions)
}

/**
 * Represents a single line's gas usage
 */
export interface GasLine {
  lineNumber: number;
  location: vscode.Range;
  gasUsed: number;
  opcodes: string[];
  percentage: number; // Percentage of block's gas
  isHotspot: boolean; // True if it's a major contributor (>20% of block)
}

/**
 * Analyzes Solidity code block-by-block for gas usage
 */
export class BlockGasAnalyzer {
  
  /**
   * Analyze hotspots and group them into blocks
   */
  public analyzeBlocks(
    hotspots: GasHotspot[],
    sourceCode: string,
    document: vscode.TextDocument
  ): GasBlock[] {
    const blocks: GasBlock[] = [];
    
    // Parse the source code to identify functions
    const functions = this.identifyFunctions(sourceCode, document);
    
    // For each function, group hotspots and analyze
    functions.forEach(func => {
      const block = this.analyzeFunctionBlock(func, hotspots, sourceCode);
      if (block) {
        blocks.push(block);
      }
    });
    
    // Sort by total gas (highest first)
    return blocks.sort((a, b) => b.totalGas - a.totalGas);
  }

  /**
   * Identify functions in the source code
   */
  private identifyFunctions(
    sourceCode: string,
    _document: vscode.TextDocument
  ): Array<{ name: string; range: vscode.Range }> {
    const functions: Array<{ name: string; range: vscode.Range }> = [];
    const lines = sourceCode.split('\n');
    
    // Regex to match function declarations
    const functionRegex = /function\s+(\w+)\s*\(/g;
    
    lines.forEach((line, index) => {
      const matches = line.matchAll(functionRegex);
      for (const match of matches) {
        const functionName = match[1];
        const startLine = index;
        
        // Find the ending brace for this function
        const endLine = this.findFunctionEnd(lines, startLine);
        
        const range = new vscode.Range(
          new vscode.Position(startLine, 0),
          new vscode.Position(endLine, lines[endLine]?.length || 0)
        );
        
        functions.push({ name: functionName, range });
      }
    });
    
    return functions;
  }

  /**
   * Find the end of a function by counting braces
   */
  private findFunctionEnd(lines: string[], startLine: number): number {
    let braceCount = 0;
    let foundStart = false;
    
    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];
      
      for (const char of line) {
        if (char === '{') {
          braceCount++;
          foundStart = true;
        } else if (char === '}') {
          braceCount--;
          if (foundStart && braceCount === 0) {
            return i;
          }
        }
      }
    }
    
    return Math.min(startLine + 50, lines.length - 1); // Fallback
  }

  /**
   * Analyze a single function block
   */
  private analyzeFunctionBlock(
    func: { name: string; range: vscode.Range },
    hotspots: GasHotspot[],
    sourceCode: string
  ): GasBlock | null {
    // Filter hotspots within this function
    const functionHotspots = hotspots.filter(h =>
      this.isWithinRange(h.location, func.range)
    );
    
    if (functionHotspots.length === 0) {
      return null;
    }
    
    // Group hotspots by line
    const lineGasMap = new Map<number, { gas: number; opcodes: string[]; location: vscode.Range }>();
    
    functionHotspots.forEach(hotspot => {
      const lineNum = hotspot.location.start.line;
      
      if (lineGasMap.has(lineNum)) {
        const existing = lineGasMap.get(lineNum)!;
        existing.gas += hotspot.gasUsed;
        existing.opcodes.push(...hotspot.opcodes);
      } else {
        lineGasMap.set(lineNum, {
          gas: hotspot.gasUsed,
          opcodes: [...hotspot.opcodes],
          location: hotspot.location
        });
      }
    });
    
    // Calculate total gas for this block
    const totalGas = Array.from(lineGasMap.values()).reduce((sum, line) => sum + line.gas, 0);
    
    // Create gas lines with percentage
    const gasLines: GasLine[] = Array.from(lineGasMap.entries())
      .map(([lineNumber, data]) => {
        const percentage = (data.gas / totalGas) * 100;
        return {
          lineNumber,
          location: data.location,
          gasUsed: data.gas,
          opcodes: data.opcodes,
          percentage,
          isHotspot: percentage > 20 // Major contributor if >20% of function
        };
      })
      .sort((a, b) => b.gasUsed - a.gasUsed); // Sort by gas usage
    
    // Identify nested blocks (loops, conditionals)
    const children = this.identifyNestedBlocks(func.range, gasLines, sourceCode);
    
    return {
      type: 'function',
      name: func.name,
      location: func.range,
      totalGas,
      lines: gasLines,
      severity: this.calculateBlockSeverity(totalGas),
      recommendation: this.generateBlockRecommendation(totalGas, gasLines, func.name),
      children
    };
  }

  /**
   * Identify nested blocks like loops and conditionals
   */
  private identifyNestedBlocks(
    functionRange: vscode.Range,
    gasLines: GasLine[],
    sourceCode: string
  ): GasBlock[] {
    const nestedBlocks: GasBlock[] = [];
    const lines = sourceCode.split('\n');
    
    // Look for loops (for, while)
    const loopRegex = /\b(for|while)\s*\(/g;
    
    for (let i = functionRange.start.line; i <= functionRange.end.line; i++) {
      const line = lines[i];
      if (!line) { continue; }
      
      const loopMatch = line.match(loopRegex);
      if (loopMatch) {
        const loopEnd = this.findBlockEnd(lines, i);
        const loopRange = new vscode.Range(
          new vscode.Position(i, 0),
          new vscode.Position(loopEnd, lines[loopEnd]?.length || 0)
        );
        
        // Get gas lines within this loop
        const loopGasLines = gasLines.filter(gl =>
          gl.lineNumber >= loopRange.start.line &&
          gl.lineNumber <= loopRange.end.line
        );
        
        if (loopGasLines.length > 0) {
          const totalGas = loopGasLines.reduce((sum, l) => sum + l.gasUsed, 0);
          
          nestedBlocks.push({
            type: 'loop',
            name: `${loopMatch[0].includes('for') ? 'For' : 'While'} Loop (Line ${i + 1})`,
            location: loopRange,
            totalGas,
            lines: loopGasLines,
            severity: this.calculateBlockSeverity(totalGas),
            recommendation: this.generateLoopRecommendation(totalGas, loopGasLines)
          });
        }
      }
    }
    
    return nestedBlocks.sort((a, b) => b.totalGas - a.totalGas);
  }

  /**
   * Find the end of a block (loop, conditional, etc.)
   */
  private findBlockEnd(lines: string[], startLine: number): number {
    let braceCount = 0;
    let foundStart = false;
    
    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];
      
      for (const char of line) {
        if (char === '{') {
          braceCount++;
          foundStart = true;
        } else if (char === '}') {
          braceCount--;
          if (foundStart && braceCount === 0) {
            return i;
          }
        }
      }
    }
    
    return Math.min(startLine + 20, lines.length - 1);
  }

  /**
   * Check if a range is within another range
   */
  private isWithinRange(inner: vscode.Range, outer: vscode.Range): boolean {
    return (
      inner.start.line >= outer.start.line &&
      inner.end.line <= outer.end.line
    );
  }

  /**
   * Calculate severity for a block
   */
  private calculateBlockSeverity(totalGas: number): 'optimal' | 'warning' | 'high' | 'critical' {
    if (totalGas < 5000) { return 'optimal'; }
    if (totalGas < 20000) { return 'warning'; }
    if (totalGas < 50000) { return 'high'; }
    return 'critical';
  }

  /**
   * Generate recommendation for a block
   */
  private generateBlockRecommendation(
    totalGas: number,
    gasLines: GasLine[],
    functionName: string
  ): string {
    const hotspotLines = gasLines.filter(l => l.isHotspot);
    
    if (hotspotLines.length === 0) {
      return `Function "${functionName}" uses ${totalGas} gas total. Generally optimized.`;
    }
    
    const topLine = hotspotLines[0];
    const recommendations: string[] = [];
    
    recommendations.push(
      `Function "${functionName}" uses ${totalGas} gas total.`
    );
    
    if (hotspotLines.length === 1) {
      recommendations.push(
        `Line ${topLine.lineNumber + 1} is responsible for ${topLine.percentage.toFixed(1)}% (${topLine.gasUsed} gas) of the function's gas usage.`
      );
    } else {
      recommendations.push(
        `Top ${hotspotLines.length} lines account for ${hotspotLines.reduce((sum, l) => sum + l.percentage, 0).toFixed(1)}% of gas usage.`
      );
      recommendations.push(
        `Highest: Line ${topLine.lineNumber + 1} (${topLine.percentage.toFixed(1)}%, ${topLine.gasUsed} gas)`
      );
    }
    
    // Add specific recommendations based on opcodes
    if (topLine.opcodes.includes('SLOAD')) {
      recommendations.push('Consider caching storage reads in memory variables.');
    }
    if (topLine.opcodes.includes('SSTORE')) {
      recommendations.push('Consider reducing storage writes or batching updates.');
    }
    if (topLine.opcodes.includes('CALL')) {
      recommendations.push('External calls are expensive. Ensure they are necessary.');
    }
    
    return recommendations.join(' ');
  }

  /**
   * Generate recommendation for a loop
   */
  private generateLoopRecommendation(totalGas: number, gasLines: GasLine[]): string {
    const recommendations: string[] = [];
    
    recommendations.push(`Loop uses ${totalGas} gas total.`);
    
    const hasStorageWrites = gasLines.some(l => l.opcodes.includes('SSTORE'));
    const hasStorageReads = gasLines.some(l => l.opcodes.includes('SLOAD'));
    
    if (hasStorageWrites) {
      recommendations.push('CRITICAL: Storage writes in loop. Consider accumulating and writing once after loop.');
    }
    if (hasStorageReads) {
      recommendations.push('WARNING: Storage reads in loop. Cache values before loop if possible.');
    }
    
    const topLine = gasLines[0];
    if (topLine) {
      recommendations.push(`Hottest line: ${topLine.lineNumber + 1} (${topLine.gasUsed} gas)`);
    }
    
    return recommendations.join(' ');
  }

  /**
   * Convert blocks to enhanced hotspots for the tour
   */
  public blocksToHotspots(blocks: GasBlock[]): GasHotspot[] {
    const hotspots: GasHotspot[] = [];
    
    blocks.forEach(block => {
      // Add a hotspot for the entire function/block
      hotspots.push({
        location: block.location,
        gasUsed: block.totalGas,
        severity: block.severity,
        opcodes: [],
        recommendation: block.recommendation,
        pattern: `${block.type}-block`
      });
      
      // Add hotspots for each significant line within the block
      block.lines
        .filter(line => line.isHotspot)
        .forEach(line => {
          hotspots.push({
            location: line.location,
            gasUsed: line.gasUsed,
            severity: this.calculateLineSeverity(line.percentage),
            opcodes: line.opcodes,
            recommendation: `This line accounts for ${line.percentage.toFixed(1)}% of ${block.name}'s gas usage (${line.gasUsed} gas). ${this.getLineOptimization(line.opcodes)}`,
            pattern: `hotspot-line`,
            suggestedFix: this.getSuggestedFix(line.opcodes)
          });
        });
      
      // Add nested blocks
      if (block.children) {
        hotspots.push(...this.blocksToHotspots(block.children));
      }
    });
    
    return hotspots;
  }

  /**
   * Calculate severity for a line based on its percentage contribution
   */
  private calculateLineSeverity(percentage: number): 'optimal' | 'warning' | 'high' | 'critical' {
    if (percentage < 20) { return 'optimal'; }
    if (percentage < 40) { return 'warning'; }
    if (percentage < 60) { return 'high'; }
    return 'critical';
  }

  /**
   * Get optimization suggestion for opcodes
   */
  private getLineOptimization(opcodes: string[]): string {
    if (opcodes.includes('SSTORE')) {
      return 'Consider if this storage write is necessary or can be batched.';
    }
    if (opcodes.includes('SLOAD')) {
      return 'Consider caching this storage read in a memory variable.';
    }
    if (opcodes.includes('CALL')) {
      return 'External calls are expensive. Minimize if possible.';
    }
    return 'Review if this operation can be optimized.';
  }

  /**
   * Get suggested code fix
   */
  private getSuggestedFix(opcodes: string[]): string {
    if (opcodes.includes('SLOAD')) {
      return '// Cache storage variable:\nuint256 cached = storageVar;\n// Use cached instead of repeated reads';
    }
    if (opcodes.includes('SSTORE')) {
      return '// Batch writes:\nuint256 temp = 0;\n// ... accumulate changes ...\nstorageVar = temp; // Single write';
    }
    return '';
  }
}
