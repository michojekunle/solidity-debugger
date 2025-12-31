import * as vscode from "vscode";
import type { GasHotspot } from "./gasSourceMapper";

/**
 * Manages code decorations and diagnostics for gas analysis
 */
export class GasDecorationManager {
  private decorationTypes: Map<string, vscode.TextEditorDecorationType>;
  private diagnosticCollection: vscode.DiagnosticCollection;
  private activeDecorations: Map<string, vscode.Range[]> = new Map();

  constructor() {
    // Create decoration types for each severity level
    this.decorationTypes = new Map([
      ['optimal', vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(0, 255, 0, 0.1)',
        border: '1px solid rgba(0, 255, 0, 0.5)',
        borderRadius: '2px',
        isWholeLine: false
      })],
      ['warning', vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(255, 255, 0, 0.15)',
        border: '1px solid rgba(255, 165, 0, 0.6)',
        borderRadius: '2px',
        isWholeLine: false
      })],
      ['high', vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(255, 165, 0, 0.2)',
        border: '1px solid rgba(255, 140, 0, 0.7)',
        borderRadius: '2px',
        isWholeLine: false
      })],
      ['critical', vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(255, 0, 0, 0.2)',
        border: '1px solid rgba(255, 0, 0, 0.8)',
        borderRadius: '2px',
        isWholeLine: false
      })]
    ]);

    // Create diagnostic collection for persistent markers
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('gas-usage');
  }

  /**
   * Apply decorations to editor for active tour
   */
  public applyTourDecorations(editor: vscode.TextEditor, hotspots: GasHotspot[]): void {
    // Clear existing decorations
    this.clearDecorations(editor);

    // Group hotspots by severity
    const decorationsBySeverity = new Map<string, vscode.DecorationOptions[]>();
    
    hotspots.forEach(hotspot => {
      if (!decorationsBySeverity.has(hotspot.severity)) {
        decorationsBySeverity.set(hotspot.severity, []);
      }

      const decoration: vscode.DecorationOptions = {
        range: hotspot.location,
        hoverMessage: this.createHoverMessage(hotspot)
      };

      decorationsBySeverity.get(hotspot.severity)!.push(decoration);
      
      // Track for cleanup
      if (!this.activeDecorations.has(hotspot.severity)) {
        this.activeDecorations.set(hotspot.severity, []);
      }
      this.activeDecorations.get(hotspot.severity)!.push(hotspot.location);
    });

    // Apply decorations
    decorationsBySeverity.forEach((decorations, severity) => {
      const decorationType = this.decorationTypes.get(severity);
      if (decorationType) {
        editor.setDecorations(decorationType, decorations);
      }
    });
  }

  /**
   * Highlight a single hotspot (for tour navigation)
   */
  public highlightCurrentHotspot(editor: vscode.TextEditor, hotspot: GasHotspot): void {
    // Clear and reapply with emphasis on current
    const emphasisDecoration = vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(100, 150, 255, 0.3)',
      border: '2px solid rgba(100, 150, 255, 0.9)',
      borderRadius: '3px',
      isWholeLine: false,
      after: {
        contentText: ` 💡 ${hotspot.gasUsed} gas`,
        color: 'rgba(100, 150, 255, 1)',
        fontWeight: 'bold',
        margin: '0 0 0 1em'
      }
    });

    editor.setDecorations(emphasisDecoration, [{
      range: hotspot.location,
      hoverMessage: this.createHoverMessage(hotspot)
    }]);
  }

  /**
   * Convert tour decorations to persistent diagnostics
   */
  public convertToDiagnostics(document: vscode.TextDocument, hotspots: GasHotspot[]): void {
    const diagnostics: vscode.Diagnostic[] = [];

    hotspots.forEach(hotspot => {
      const severity = this.mapSeverityToDiagnostic(hotspot.severity);
      const diagnostic = new vscode.Diagnostic(
        hotspot.location,
        `${hotspot.recommendation} (${hotspot.gasUsed} gas)`,
        severity
      );
      
      diagnostic.code = 'gas-usage';
      diagnostic.source = 'Solidity Debugger';
      
      diagnostics.push(diagnostic);
    });

    this.diagnosticCollection.set(document.uri, diagnostics);
  }

  /**
   * Clear all decorations
   */
  public clearDecorations(editor: vscode.TextEditor): void {
    this.decorationTypes.forEach(decorationType => {
      editor.setDecorations(decorationType, []);
    });
    this.activeDecorations.clear();
  }

  /**
   * Clear diagnostics for a document
   */
  public clearDiagnostics(document: vscode.TextDocument): void {
    this.diagnosticCollection.delete(document.uri);
  }

  /**
   * Clear all diagnostics
   */
  public clearAllDiagnostics(): void {
    this.diagnosticCollection.clear();
  }

  /**
   * Create hover message for a hotspot
   */
  private createHoverMessage(hotspot: GasHotspot): vscode.MarkdownString {
    const message = new vscode.MarkdownString();
    message.isTrusted = true;

    // Severity icon
    const icon = {
      'optimal': '✅',
      'warning': '⚠️',
      'high': '🔥',
      'critical': '🚨'
    }[hotspot.severity] || '📊';

    message.appendMarkdown(`### ${icon} Gas Usage: **${hotspot.gasUsed}** gas\n\n`);
    message.appendMarkdown(`**Severity:** ${hotspot.severity.toUpperCase()}\n\n`);
    
    if (hotspot.opcodes.length > 0) {
      message.appendMarkdown(`**Operations:** ${hotspot.opcodes.join(', ')}\n\n`);
    }

    message.appendMarkdown(`💡 **Recommendation:**\n${hotspot.recommendation}\n\n`);

    if (hotspot.suggestedFix) {
      message.appendMarkdown(`🔧 **Suggested Fix:**\n\`\`\`solidity\n${hotspot.suggestedFix}\n\`\`\`\n`);
    }

    return message;
  }

  /**
   * Map hotspot severity to diagnostic severity
   */
  private mapSeverityToDiagnostic(severity: string): vscode.DiagnosticSeverity {
    switch (severity) {
      case 'critical':
        return vscode.DiagnosticSeverity.Error;
      case 'high':
        return vscode.DiagnosticSeverity.Warning;
      case 'warning':
        return vscode.DiagnosticSeverity.Information;
      case 'optimal':
        return vscode.DiagnosticSeverity.Hint;
      default:
        return vscode.DiagnosticSeverity.Information;
    }
  }

  /**
   * Dispose all resources
   */
  public dispose(): void {
    this.decorationTypes.forEach(decorationType => decorationType.dispose());
    this.diagnosticCollection.dispose();
  }
}
