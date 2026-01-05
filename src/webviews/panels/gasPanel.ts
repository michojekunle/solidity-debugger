import * as vscode from "vscode"
import type { GasAnalyzerService } from "../../extension"

export class GasAnalyzerPanel {
  public static currentPanel: GasAnalyzerPanel | undefined
  private readonly _panel: vscode.WebviewPanel
  private _disposables: vscode.Disposable[] = []
  private _gasAnalyzerService: GasAnalyzerService | undefined

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, gasAnalyzerService?: GasAnalyzerService) {
    this._panel = panel
    this._gasAnalyzerService = gasAnalyzerService

    // Set the webview's initial html content
    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview, extensionUri)

    // Listen for when the panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables)

    // Set up message handlers
    this.setupMessageHandlers()
  }

  public static createOrShow(extensionUri: vscode.Uri, gasAnalyzerService?: GasAnalyzerService) {
    const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined

    // If we already have a panel, show it
    if (GasAnalyzerPanel.currentPanel) {
      GasAnalyzerPanel.currentPanel._panel.reveal(column)
      return
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      "gasAnalyzer",
      "Solidity Gas Analyzer",
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.parse(extensionUri.toString() + "/media"),
          vscode.Uri.parse(extensionUri.toString() + "/webview-ui/build"),
        ],
        retainContextWhenHidden: true,
      },
    )

    GasAnalyzerPanel.currentPanel = new GasAnalyzerPanel(panel, extensionUri, gasAnalyzerService)
  }

  private setupMessageHandlers() {
    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case "getGasUsage":
            this.sendGasAnalysisResults()
            break

          case "analyzeGasUsage":
            if (this._gasAnalyzerService) {
              this._gasAnalyzerService.analyzeGasUsage()
            }
            break
        }
      },
      null,
      this._disposables,
    )

    if (this._gasAnalyzerService) {
      this._disposables.push(
        this._gasAnalyzerService.onGasAnalysisComplete((gasAnalysis) => {
          this._panel.webview.postMessage({
            command: "updateGasUsage",
            gasUsage: gasAnalysis,
          })
        }),
      )
    }
  }

  private sendGasAnalysisResults() {
    if (this._gasAnalyzerService) {
      // Trigger analysis when panel requests it
      this._gasAnalyzerService.analyzeGasUsage()
    } else {
      // Fallback to mock data
      const gasUsage = GasAnalyzerPanel.getGasUsage()
      this._panel.webview.postMessage({
        command: "updateGasUsage",
        gasUsage,
      })
    }
  }

  private static getGasUsage() {
    // Mock data for testing
    return [
      {
        functionName: "transfer(address,uint256)",
        gasUsed: 65000,
        recommendations: [
          "Consider caching balance in memory",
          "Use unchecked blocks for arithmetic operations where overflow is impossible",
        ],
      },
      {
        functionName: "mint(address,uint256)",
        gasUsed: 120000,
        recommendations: ["Batch multiple mint operations", "Use uint96 instead of uint256 for smaller storage"],
      },
    ]
  }

  private _getHtmlForWebview(_webview: vscode.Webview, _extensionUri: vscode.Uri) {
    const nonce = getNonce()

    return `<!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Solidity Gas Analyzer</title>
          <style>
            * { box-sizing: border-box; }
            body {
              padding: 0;
              margin: 0;
              font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
              color: var(--vscode-foreground, #cccccc);
              background-color: var(--vscode-editor-background, #1e1e1e);
              font-size: 13px;
            }
            .container {
              padding: 20px;
              max-width: 1200px;
              margin: 0 auto;
            }
            .header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-bottom: 24px;
              padding-bottom: 16px;
              border-bottom: 1px solid var(--vscode-panel-border, #444);
            }
            .title {
              font-size: 20px;
              font-weight: 600;
              display: flex;
              align-items: center;
              gap: 10px;
            }
            .title::before {
              content: '⚡';
              font-size: 24px;
            }
            .analyze-btn {
              background: linear-gradient(135deg, #007ACC 0%, #0066B8 100%);
              color: white;
              padding: 10px 20px;
              border: none;
              border-radius: 6px;
              cursor: pointer;
              font-weight: 600;
              font-size: 13px;
              transition: all 0.2s ease;
            }
            .analyze-btn:hover {
              background: linear-gradient(135deg, #0088E8 0%, #007ACC 100%);
              transform: translateY(-1px);
              box-shadow: 0 4px 12px rgba(0, 122, 204, 0.4);
            }
            .stats-bar {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
              gap: 16px;
              margin-bottom: 24px;
            }
            .stat-card {
              background: var(--vscode-editor-inactiveSelectionBackground, #2d2d2d);
              border: 1px solid var(--vscode-panel-border, #444);
              border-radius: 8px;
              padding: 16px;
              text-align: center;
            }
            .stat-value {
              font-size: 24px;
              font-weight: 700;
              color: var(--vscode-charts-blue, #4fc3f7);
            }
            .stat-label {
              font-size: 11px;
              text-transform: uppercase;
              color: var(--vscode-descriptionForeground, #888);
              margin-top: 4px;
            }
            .gas-container {
              display: flex;
              flex-direction: column;
              gap: 16px;
            }
            .function-card {
              background: var(--vscode-editor-inactiveSelectionBackground, #252526);
              border: 1px solid var(--vscode-panel-border, #3c3c3c);
              border-radius: 8px;
              overflow: hidden;
              transition: border-color 0.2s ease;
            }
            .function-card:hover {
              border-color: var(--vscode-focusBorder, #007ACC);
            }
            .function-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 16px;
              border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
            }
            .function-name {
              font-weight: 600;
              font-size: 14px;
              color: var(--vscode-symbolIcon-functionForeground, #DCDCAA);
              font-family: var(--vscode-editor-font-family, monospace);
            }
            .gas-badge {
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .severity-badge {
              padding: 4px 10px;
              border-radius: 12px;
              font-size: 11px;
              font-weight: 600;
              text-transform: uppercase;
            }
            .severity-critical { background: #5c1a1a; color: #f48771; }
            .severity-high { background: #5c3c1a; color: #f9a825; }
            .severity-warning { background: #3c3c1a; color: #fff176; }
            .severity-low { background: #1a3c2a; color: #81c784; }
            .gas-value {
              font-family: var(--vscode-editor-font-family, monospace);
              font-weight: 600;
              color: var(--vscode-charts-orange, #ff9800);
            }
            .function-body {
              padding: 16px;
            }
            .recommendations {
              background: var(--vscode-textBlockQuote-background, #2d2d2d);
              border-left: 3px solid var(--vscode-charts-yellow, #ffc107);
              padding: 12px 16px;
              border-radius: 0 6px 6px 0;
              margin-top: 12px;
            }
            .recommendations-title {
              font-weight: 600;
              margin-bottom: 8px;
              font-size: 12px;
              color: var(--vscode-charts-yellow, #ffc107);
            }
            .recommendation-item {
              margin: 8px 0;
              padding-left: 20px;
              position: relative;
              line-height: 1.5;
            }
            .recommendation-item::before {
              content: '→';
              position: absolute;
              left: 0;
              color: var(--vscode-charts-green, #4caf50);
            }
            .empty-state {
              text-align: center;
              padding: 60px 20px;
              color: var(--vscode-descriptionForeground, #888);
            }
            .empty-state-icon {
              font-size: 48px;
              margin-bottom: 16px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="title">Gas Analyzer</div>
              <button class="analyze-btn" onclick="analyzeGas()">🔍 Analyze Contract</button>
            </div>
            <div class="stats-bar" id="stats-bar">
              <div class="stat-card"><div class="stat-value">-</div><div class="stat-label">Functions</div></div>
              <div class="stat-card"><div class="stat-value">-</div><div class="stat-label">Total Gas</div></div>
              <div class="stat-card"><div class="stat-value">-</div><div class="stat-label">Hotspots</div></div>
            </div>
            <div id="gas-usage" class="gas-container">
              <div class="empty-state">
                <div class="empty-state-icon">⚡</div>
                <div>Click "Analyze Contract" to start gas analysis</div>
              </div>
            </div>
          </div>
          
          <script nonce="${nonce}">
            const vscode = acquireVsCodeApi();
            
            window.addEventListener('message', event => {
              const message = event.data;
              if (message.command === 'updateGasUsage') {
                renderGasUsage(message.gasUsage);
              }
            });
            
            function analyzeGas() {
              document.getElementById('gas-usage').innerHTML = '<div class="empty-state"><div class="empty-state-icon">⏳</div><div>Analyzing...</div></div>';
              vscode.postMessage({ command: 'analyzeGasUsage' });
            }
            
            vscode.postMessage({ command: 'getGasUsage' });
            
            function getSeverity(gas) {
              if (gas >= 50000) return { class: 'critical', text: 'Critical' };
              if (gas >= 20000) return { class: 'high', text: 'High' };
              if (gas >= 5000) return { class: 'warning', text: 'Warning' };
              return { class: 'low', text: 'Low' };
            }
            
            function renderGasUsage(gasUsage) {
              const container = document.getElementById('gas-usage');
              const statsBar = document.getElementById('stats-bar');
              
              if (!gasUsage || gasUsage.length === 0) {
                container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📊</div><div>No gas data. Run analysis first.</div></div>';
                return;
              }
              
              const totalGas = gasUsage.reduce((sum, item) => sum + (item.gasUsed || 0), 0);
              const hotspots = gasUsage.filter(item => (item.gasUsed || 0) >= 20000).length;
              
              statsBar.innerHTML = \`
                <div class="stat-card"><div class="stat-value">\${gasUsage.length}</div><div class="stat-label">Functions</div></div>
                <div class="stat-card"><div class="stat-value">\${totalGas.toLocaleString()}</div><div class="stat-label">Total Gas</div></div>
                <div class="stat-card"><div class="stat-value">\${hotspots}</div><div class="stat-label">Hotspots</div></div>
              \`;
              
              container.innerHTML = gasUsage.map(item => {
                const severity = getSeverity(item.gasUsed || 0);
                const recs = item.recommendations || (item.recommendation ? [item.recommendation] : []);
                
                return \`
                  <div class="function-card">
                    <div class="function-header">
                      <div class="function-name">\${item.functionName || 'Unknown'}</div>
                      <div class="gas-badge">
                        <span class="severity-badge severity-\${severity.class}">\${severity.text}</span>
                        <span class="gas-value">\${(item.gasUsed || 0).toLocaleString()} gas</span>
                      </div>
                    </div>
                    <div class="function-body">
                      \${recs.length > 0 ? \`
                        <div class="recommendations">
                          <div class="recommendations-title">💡 Optimization Recommendations</div>
                          \${recs.map(rec => \`<div class="recommendation-item">\${rec}</div>\`).join('')}
                        </div>
                      \` : '<div style="color: #888;">No specific recommendations</div>'}
                    </div>
                  </div>
                \`;
              }).join('');
            }
          </script>
        </body>
        </html>`
  }

  public dispose() {
    GasAnalyzerPanel.currentPanel = undefined

    while (this._disposables.length) {
      const disposable = this._disposables.pop()
      if (disposable) {
        disposable.dispose()
      }
    }

    this._panel.dispose()
  }
}

function getNonce() {
  let text = ""
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }
  return text
}
