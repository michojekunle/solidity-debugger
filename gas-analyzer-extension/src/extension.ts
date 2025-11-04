// src/extension.ts
import * as vscode from "vscode";
import { StaticAnalyzer } from "./analyzers/staticAnalyzer";
import { HoverProvider } from "./providers/hoverProvider";
import { DiagnosticProvider } from "./providers/diagnosticProvider";

export function activate(context: vscode.ExtensionContext) {
  console.log("Gas Optimizer Extension activated");

  // Initialize analyzers
  const staticAnalyzer = new StaticAnalyzer();
  const diagnosticProvider = new DiagnosticProvider(staticAnalyzer);

  // Register providers
  const hoverProvider = vscode.languages.registerHoverProvider(
    "solidity",
    new HoverProvider(staticAnalyzer)
  );

  const diagnosticCollection =
    vscode.languages.createDiagnosticCollection("gasOptimizer");

  // File watcher for real-time analysis
  const fileWatcher = vscode.workspace.onDidChangeTextDocument(
    debounce((e) => analyzeDocument(e.document), 500)
  );

  context.subscriptions.push(hoverProvider, fileWatcher);
}

function debounce(func: Function, wait: number) {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
