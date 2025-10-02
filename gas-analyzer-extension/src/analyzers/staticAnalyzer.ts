// src/analyzers/staticAnalyzer.ts
import { parse, visit } from '@solidity-parser/parser';
import { GasPattern, OptimizationSuggestion } from '../types';

export class StaticAnalyzer {
    private gasPatterns: GasPattern[] = [
        {
            name: 'redundantSLOAD',
            pattern: /(\w+)\[(\w+)\].*\1\[\2\]/g,
            gasImpact: 2100,
            severity: 'critical',
            description: 'Multiple reads of same storage slot'
        },
        {
            name: 'storageInLoop',
            pattern: /for\s*\([^)]*\)\s*\{[^}]*\w+\[[^\]]+\]\s*=/g,
            gasImpact: 5000,
            severity: 'critical',
            description: 'Storage write inside loop'
        }
    ];

    async analyzeContract(code: string): Promise<OptimizationSuggestion[]> {
        const suggestions: OptimizationSuggestion[] = [];
        
        try {
            // Parse Solidity AST
            const ast = parse(code, { 
                loc: true, 
                range: true 
            });
            
            // Pattern-based analysis
            suggestions.push(...this.detectPatterns(code));
            
            // AST-based analysis
            suggestions.push(...this.analyzeAST(ast, code));
            
        } catch (error) {
            console.error('Static analysis failed:', error);
        }
        
        return suggestions;
    }

    private detectPatterns(code: string): OptimizationSuggestion[] {
        const suggestions: OptimizationSuggestion[] = [];
        
        this.gasPatterns.forEach(pattern => {
            const matches = Array.from(code.matchAll(pattern.pattern));
            
            matches.forEach(match => {
                if (match.index !== undefined) {
                    suggestions.push({
                        type: pattern.name,
                        severity: pattern.severity,
                        message: pattern.description,
                        gasImpact: pattern.gasImpact,
                        position: this.getPositionFromIndex(code, match.index),
                        quickFix: this.generateQuickFix(pattern.name, match[0])
                    });
                }
            });
        });
        
        return suggestions;
    }

    private analyzeAST(ast: any, code: string): OptimizationSuggestion[] {
        const suggestions: OptimizationSuggestion[] = [];
        
        visit(ast, {
            FunctionDefinition: (node) => {
                // Check for public vs external
                if (node.visibility === 'public' && !node.override) {
                    suggestions.push({
                        type: 'publicVsExternal',
                        severity: 'moderate',
                        message: 'Consider using external for gas savings',
                        gasImpact: 200,
                        position: node.loc,
                        quickFix: {
                            title: 'Change to external',
                            edit: code.replace('public', 'external')
                        }
                    });
                }
            },
            
            StructDefinition: (node) => {
                // Check for struct packing opportunities
                const packingAnalysis = this.analyzeStructPacking(node);
                if (packingAnalysis.canOptimize) {
                    suggestions.push(packingAnalysis.suggestion);
                }
            }
        });
        
        return suggestions;
    }
}