import * as vscode from "vscode"
import { ErrorHandler } from "../../utils/errorHandler"

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

  public readonly onGasEstimationUpdated = this.eventEmitter.event

  /**
   * Improved trace processing with validation
   */
  public processTransactionTrace(traceData: any) {
    try {
      if (!traceData || typeof traceData !== "object") {
        this.errorHandler.warn("Invalid trace data provided", "GAS_ANALYSIS")
        return
      }

      const gasUsed = traceData.result?.gasUsed || 0
      const functionName = this.extractFunctionName(traceData)

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
  private analyzeOpcodes(traceData: any) {
    const stats = {
      sloadCount: 0,
      sstoreCount: 0,
      callCount: 0,
    }

    try {
      if (!Array.isArray(traceData.structLogs)) {
        return stats
      }

      for (const log of traceData.structLogs) {
        if (!log || typeof log !== "object") continue

        if (log.op === "SLOAD") stats.sloadCount++
        else if (log.op === "SSTORE") stats.sstoreCount++
        else if (log.op === "CALL" || log.op === "DELEGATECALL") stats.callCount++
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
      const gasUsed = traceData.result?.gasUsed || 0

      // High gas usage check
      if (gasUsed > 500000) {
        recommendations.push("High gas usage detected. Consider refactoring to reduce complexity.")
      } else if (gasUsed > 100000) {
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
        recommendations.push("Function is reasonably optimized.")
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
