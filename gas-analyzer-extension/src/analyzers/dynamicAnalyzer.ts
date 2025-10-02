// src/analyzers/dynamicAnalyzer.ts
import { ethers } from 'ethers';
import { compile } from '@ethereum-waffle/compiler';

export class DynamicAnalyzer {
    private provider: ethers.providers.JsonRpcProvider;
    private gasTracker: GasTracker;

    constructor() {
        // Initialize local ganache instance
        this.provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
        this.gasTracker = new GasTracker();
    }

    async analyzeGasUsage(contractCode: string, functionName: string): Promise<GasAnalysis> {
        try {
            // Compile contract
            const compiled = await this.compileContract(contractCode);
            
            // Deploy to local network
            const contract = await this.deployContract(compiled);
            
            // Simulate function calls with gas tracking
            const gasUsage = await this.simulateExecution(contract, functionName);
            
            // Analyze gas breakdown
            const breakdown = await this.analyzeGasBreakdown(gasUsage);
            
            return {
                totalGas: gasUsage.gasUsed,
                breakdown,
                optimizationOpportunities: this.identifyOptimizations(breakdown)
            };
            
        } catch (error) {
            console.error('Dynamic analysis failed:', error);
            return { totalGas: 0, breakdown: [], optimizationOpportunities: [] };
        }
    }

    private async simulateExecution(contract: ethers.Contract, functionName: string): Promise<any> {
        // Enable gas tracking
        const tx = await contract.populateTransaction[functionName]();
        
        // Use debug_traceTransaction for detailed gas breakdown
        const trace = await this.provider.send('debug_traceTransaction', [
            tx.hash,
            { tracer: 'callTracer', tracerConfig: { withLog: true } }
        ]);
        
        return this.gasTracker.analyzeTrace(trace);
    }

    private identifyOptimizations(breakdown: GasBreakdown[]): OptimizationSuggestion[] {
        const suggestions: OptimizationSuggestion[] = [];
        
        // Look for expensive operations
        breakdown.forEach(step => {
            if (step.opcode === 'SSTORE' && step.gasCost > 20000) {
                suggestions.push({
                    type: 'expensiveStorage',
                    severity: 'critical',
                    message: 'High-cost storage operation detected',
                    gasImpact: step.gasCost - 2900, // Potential savings
                    quickFix: {
                        title: 'Optimize storage usage',
                        description: 'Consider batching or caching'
                    }
                });
            }
        });
        
        return suggestions;
    }
}