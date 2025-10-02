import * as vscode from 'vscode';

interface GasUsage {
    functionName: string;
    gasUsed: number;
    recommendations: string[];
  }
  
  export class GasEstimator {
    private gasUsageMap: Map<string, GasUsage> = new Map();
    private eventEmitter = new vscode.EventEmitter<GasUsage[]>();
    
    public readonly onGasEstimationUpdated = this.eventEmitter.event;
  
    public processTransactionTrace(traceData: any) {
      // Process the trace to estimate gas usage
      // This is a simplified implementation
      if (!traceData || !traceData.result) return;
      
      const gasUsed = traceData.result.gasUsed;
      const functionName = this.extractFunctionName(traceData);
      
      const recommendations = this.generateOptimizationRecommendations(traceData);
      
      const gasUsage: GasUsage = {
        functionName,
        gasUsed,
        recommendations
      };
      
      this.gasUsageMap.set(functionName, gasUsage);
      this.eventEmitter.fire(Array.from(this.gasUsageMap.values()));
    }
  
    private extractFunctionName(traceData: any): string {
      // Extract function name from transaction input
      // This is a simplified implementation
      if (!traceData.input || traceData.input.length < 10) {
        return 'Unknown Function';
      }
      
      // The first 4 bytes (8 hex chars) of the input data represent the function selector
      const functionSelector = traceData.input.slice(0, 10);
      return `Function(${functionSelector})`;
    }
  
    private generateOptimizationRecommendations(traceData: any): string[] {
      // Generate optimization recommendations based on the trace
      // This is a simplified implementation
      const recommendations: string[] = [];
      
      // Check for common gas optimization opportunities
      if (traceData.result.gasUsed > 100000) {
        recommendations.push('Consider implementing gas optimization patterns.');
      }
      
      // Check for expensive opcodes
      if (traceData.structLogs) {
        let sloadCount = 0;
        let sstoreCount = 0;
        
        for (const log of traceData.structLogs) {
          if (log.op === 'SLOAD') sloadCount++;
          if (log.op === 'SSTORE') sstoreCount++;
        }
        
        if (sloadCount > 10) {
          recommendations.push('Multiple SLOAD operations detected. Consider caching storage variables in memory.');
        }
        
        if (sstoreCount > 5) {
          recommendations.push('Multiple SSTORE operations detected. Consider batching storage updates.');
        }
      }
      
      return recommendations;
    }
  
    public getGasUsage(): GasUsage[] {
      return Array.from(this.gasUsageMap.values());
    }
  
    public clearGasUsage() {
      this.gasUsageMap.clear();
    }
  }
  