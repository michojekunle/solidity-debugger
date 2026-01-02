import * as vscode from "vscode"
import { ErrorHandler } from "../../utils/errorHandler"
import { BytecodeAnalyzer, OpcodeStats } from "./bytecodeAnalyzer"

interface GasUsage {
  functionName: string
  gasUsed: number
  recommendations: string[]
  timestamp: number
  sloadCount: number
  sstoreCount: number
  callCount: number
}

/**
 * Enhanced gas estimator with pattern detection and optimization suggestions
 */
export class GasEstimator implements vscode.Disposable {
  private gasUsageMap: Map<string, GasUsage> = new Map()
  private eventEmitter = new vscode.EventEmitter<GasUsage[]>()
  private errorHandler = new ErrorHandler()
  private bytecodeAnalyzer = new BytecodeAnalyzer()

  public readonly onGasEstimationUpdated = this.eventEmitter.event

  /**
   * Process transaction trace or static bytecode
   */
  public processTrace(traceOrBytecode: any, functionName: string = "Unknown") {
      if (typeof traceOrBytecode === 'string') {
          // It's bytecode
          this.analyzeStaticBytecode(traceOrBytecode, functionName);
      } else {
          // It's a JSON-RPC trace
          this.processTransactionTrace(traceOrBytecode, functionName);
      }
  }

  private analyzeStaticBytecode(bytecode: string, functionName: string) {
      try {
          const stats = this.bytecodeAnalyzer.analyze(bytecode);
          const estimatedGas = this.bytecodeAnalyzer.estimateBaseGas(stats);
          const recommendations = this.generateOptimizationRecommendations(null, stats); // null trace for static

          const gasUsage: GasUsage = {
              functionName,
              gasUsed: estimatedGas,
              recommendations,
              timestamp: Date.now(),
              sloadCount: stats.sloadCount,
              sstoreCount: stats.sstoreCount,
              callCount: stats.callCount
          };

          this.gasUsageMap.set(functionName, gasUsage);
          this.eventEmitter.fire(Array.from(this.gasUsageMap.values()));
          
      } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          this.errorHandler.handleError("GAS_ANALYSIS_ERROR", "Error analyzing bytecode", "", err);
      }
  }


  /**
   * Improved trace processing with validation
   */
  public processTransactionTrace(traceData: any, knownFunctionName?: string) {
    try {
      if (!traceData || typeof traceData !== "object" || (!traceData.result && !traceData.structLogs)) {
        this.errorHandler.warn("Invalid trace data provided", "GAS_ANALYSIS")
        return
      }

      const gasUsed = traceData.result?.gasUsed || 0
      const functionName = knownFunctionName || this.extractFunctionName(traceData)

      const opcodeStats = this.analyzeOpcodes(traceData)

      const recommendations = this.generateOptimizationRecommendations(traceData, opcodeStats)

      const gasUsage: GasUsage = {
        functionName,
        gasUsed,
        recommendations,
        timestamp: Date.now(),
        sloadCount: opcodeStats.sloadCount,
        sstoreCount: opcodeStats.sstoreCount,
        callCount: opcodeStats.callCount,
      }

      this.gasUsageMap.set(functionName, gasUsage)
      this.eventEmitter.fire(Array.from(this.gasUsageMap.values()))

      this.errorHandler.log(`Gas analysis complete for ${functionName}: ${gasUsed} gas used`)
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      this.errorHandler.handleError("GAS_ANALYSIS_ERROR", "Error processing transaction trace", "", err)
    }
  }

  /**
   * Improved function name extraction
   */
  private extractFunctionName(traceData: any): string {
    try {
      if (!traceData.input || traceData.input.length < 10) {
        return "Unknown Function"
      }

      const functionSelector = traceData.input.slice(0, 10)

      // Try to look up in known selectors
      const knownSelectors: Record<string, string> = {
        "0xa9059cbb": "transfer",
        "0x095ea7b3": "approve",
        "0x40c10f19": "mint",
        "0x42966c68": "burn",
        "0x70a08231": "balanceOf",
      }

      return knownSelectors[functionSelector] || `Function(${functionSelector})`
    } catch (error) {
      return "Unknown Function"
    }
  }

  /**
   * New method to analyze opcodes in trace
   */
  private analyzeOpcodes(traceData: any): OpcodeStats {
      // Reconstitute stats from trace logs
     const stats: OpcodeStats = { sloadCount: 0, sstoreCount: 0, callCount: 0, delegateCallCount: 0, staticCallCount: 0, logCount: 0, createCount: 0, selfDestructCount: 0, memoryOpsCount: 0, cryptoOpsCount: 0, totalOpcodes: 0};
    
    try {
      if (!Array.isArray(traceData.structLogs)) {
        return stats
      }

      for (const log of traceData.structLogs) {
        if (!log || typeof log !== "object") continue
        
        // This is a rough mapping from trace strings to stats
        if (log.op === "SLOAD") stats.sloadCount++
        else if (log.op === "SSTORE") stats.sstoreCount++
        else if (log.op === "CALL") stats.callCount++
        else if (log.op === "DELEGATECALL") stats.delegateCallCount++
        else if (log.op === "STATICCALL") stats.staticCallCount++
        else if (log.op && log.op.startsWith("LOG")) stats.logCount++
        else if (log.op === "SHA3") stats.cryptoOpsCount++
      }
    } catch (error) {
      this.errorHandler.warn("Error analyzing opcodes", "OPCODE_ANALYSIS")
    }

    return stats
  }

  /**
   * Improved recommendation generation with weighted suggestions
   */
  private generateOptimizationRecommendations(
    traceData: any,
    opcodeStats: { sloadCount: number; sstoreCount: number; callCount: number },
  ): string[] {
    const recommendations: string[] = []

    try {
      const { sloadCount, sstoreCount, callCount } = opcodeStats
      // traceData is null for static analysis
      const gasUsed = traceData ? (traceData.result?.gasUsed || 0) : 0

      // High gas usage check (dynamic only)
      if (traceData && gasUsed > 500000) {
        recommendations.push("High gas usage detected. Consider refactoring to reduce complexity.")
      } else if (traceData && gasUsed > 100000) {
        recommendations.push("Moderate gas usage. Look for optimization opportunities.")
      }

      // Storage access patterns
      if (sloadCount > 20) {
        recommendations.push("High storage read count. Cache frequently accessed variables in memory.")
      }

      if (sstoreCount > 10) {
        recommendations.push(
          "High storage write count. Batch storage updates or use transient storage when applicable.",
        )
      }

      if (sloadCount > sstoreCount * 3) {
        recommendations.push("Asymmetric storage pattern. Consider pre-loading data before operations.")
      }

      // External call patterns
      if (callCount > 5) {
        recommendations.push("Multiple external calls detected. Minimize external dependencies if possible.")
      }

      // Provide default recommendation if none generated
      if (recommendations.length === 0) {
        recommendations.push("Function appears reasonably optimized based on static analysis.")
      }
    } catch (error) {
      this.errorHandler.warn("Error generating recommendations", "RECOMMENDATION_GEN")
    }

    return recommendations
  }

  /**
   * Get all gas usage data
   */
  public getGasUsage(): GasUsage[] {
    return Array.from(this.gasUsageMap.values())
  }

  /**
   * Get gas usage for specific function
   */
  public getGasUsageForFunction(functionName: string): GasUsage | undefined {
    return this.gasUsageMap.get(functionName)
  }

  /**
   * Clear gas usage data
   */
  public clearGasUsage() {
    this.gasUsageMap.clear()
  }

  /**
   * Dispose resources
   */
  public dispose() {
    this.eventEmitter.dispose()
  }
}
