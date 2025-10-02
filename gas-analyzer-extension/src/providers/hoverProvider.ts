// src/providers/hoverProvider.ts
import * as vscode from 'vscode';
import { StaticAnalyzer } from '../analyzers/staticAnalyzer';

export class HoverProvider implements vscode.HoverProvider {
    constructor(private analyzer: StaticAnalyzer) {}

    async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<vscode.Hover | undefined> {
        
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) return;

        // Get gas analysis for current position
        const gasInfo = await this.analyzer.getGasInfoAtPosition(
            document.getText(),
            document.offsetAt(position)
        );

        if (!gasInfo) return;

        // Create hover content
        const markdown = new vscode.MarkdownString();
        markdown.appendMarkdown(`### ⛽ Gas Analysis\n`);
        markdown.appendMarkdown(`**Current Cost:** ${gasInfo.currentGas} gas\n`);
        
        if (gasInfo.optimizedGas) {
            const savings = gasInfo.currentGas - gasInfo.optimizedGas;
            const percentage = Math.round((savings / gasInfo.currentGas) * 100);
            
            markdown.appendMarkdown(`**Optimized Cost:** ${gasInfo.optimizedGas} gas\n`);
            markdown.appendMarkdown(`**Potential Savings:** ${savings} gas (${percentage}%)\n\n`);
            
            markdown.appendMarkdown(`💡 **Suggestion:** ${gasInfo.suggestion}\n`);
            
            // Add quick fix command
            const commandUri = vscode.Uri.parse(
                `command:gasOptimizer.applyFix?${encodeURIComponent(
                    JSON.stringify({ position, fixType: gasInfo.fixType })
                )}`
            );
            markdown.appendMarkdown(`[🔧 Apply Quick Fix](${commandUri})`);
        }

        return new vscode.Hover(markdown, wordRange);
    }
}

// src/providers/diagnosticProvider.ts
export class DiagnosticProvider {
    private diagnosticCollection: vscode.DiagnosticCollection;

    constructor(private analyzer: StaticAnalyzer) {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('gasOptimizer');
    }

    async updateDiagnostics(document: vscode.TextDocument): Promise<void> {
        const suggestions = await this.analyzer.analyzeContract(document.getText());
        
        const diagnostics: vscode.Diagnostic[] = suggestions.map(suggestion => {
            const range = new vscode.Range(
                suggestion.position.start.line - 1,
                suggestion.position.start.column,
                suggestion.position.end.line - 1,
                suggestion.position.end.column
            );

            const diagnostic = new vscode.Diagnostic(
                range,
                `${suggestion.message} (${suggestion.gasImpact} gas)`,
                this.getSeverity(suggestion.severity)
            );

            diagnostic.source = 'Gas Optimizer';
            diagnostic.code = suggestion.type;
            
            return diagnostic;
        });

        this.diagnosticCollection.set(document.uri, diagnostics);
    }

    private getSeverity(severity: string): vscode.DiagnosticSeverity {
        switch (severity) {
            case 'critical': return vscode.DiagnosticSeverity.Error;
            case 'moderate': return vscode.DiagnosticSeverity.Warning;
            case 'info': return vscode.DiagnosticSeverity.Information;
            default: return vscode.DiagnosticSeverity.Hint;
        }
    }
}