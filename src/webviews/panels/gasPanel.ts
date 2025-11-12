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

  private _getHtmlForWebview(webview: vscode.Webview, extensionUri: vscode.Uri) {
    const nonce = getNonce()

    return `<!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Solidity Gas Analyzer</title>
          <style>
            body {
              padding: 0;
              margin: 0;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              color: #333;
              background-color: #f8f8f8;
            }
            .container {
              padding: 20px;
            }
            .title {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 20px;
            }
            .button {
              background-color: #0078D7;
              color: white;
              padding: 10px 20px;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              margin-bottom: 20px;
            }
            .button:hover {
              background-color: #005A9E;
            }
            .gas-container {
              display: flex;
              flex-direction: column;
              gap: 20px;
            }
            .function-gas {
              background-color: white;
              border: 1px solid #ddd;
              border-radius: 4px;
              padding: 15px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .function-name {
              font-weight: bold;
              color: #0078D7;
              margin-bottom: 5px;
            }
            .gas-used {
              display: flex;
              align-items: center;
              margin-bottom: 10px;
            }
            .gas-value {
              font-weight: bold;
              margin-left: 5px;
            }
            .recommendations {
              background-color: #FFF8E1;
              padding: 10px;
              border-radius: 4px;
              border-left: 4px solid #FFC107;
            }
            .recommendations-title {
              font-weight: bold;
              margin-bottom: 5px;
            }
            .recommendation-item {
              margin-left: 15px;
              margin-bottom: 5px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="title">Solidity Gas Analyzer</div>
            <button class="button" onclick="analyzeGas()">Analyze Current Contract</button>
            <div id="gas-usage" class="gas-container">
              <!-- Gas usage will be rendered here -->
              <div class="function-gas">
                <div class="function-name">Waiting for analysis...</div>
              </div>
            </div>
          </div>
          
          <script nonce="${nonce}">
            const vscode = acquireVsCodeApi();
            
            // Setup event listener to receive messages from the extension
            window.addEventListener('message', event => {
              const message = event.data;
              
              switch (message.command) {
                case 'updateGasUsage':
                  renderGasUsage(message.gasUsage);
                  break;
              }
            });
            
            function analyzeGas() {
              vscode.postMessage({
                command: 'analyzeGasUsage'
              });
            }
            
            // Request initial gas usage data
            vscode.postMessage({
              command: 'getGasUsage'
            });
            
            function renderGasUsage(gasUsage) {
              const container = document.getElementById('gas-usage');
              container.innerHTML = '';
              
              if (gasUsage.length === 0) {
                container.innerHTML = '<div class="function-gas">No gas usage data available.</div>';
                return;
              }
              
              gasUsage.forEach(item => {
                const el = document.createElement('div');
                el.className = 'function-gas';
                
                const funcName = document.createElement('div');
                funcName.className = 'function-name';
                funcName.textContent = item.functionName;
                el.appendChild(funcName);
                
                const gasUsed = document.createElement('div');
                gasUsed.className = 'gas-used';
                gasUsed.textContent = 'Gas Used: ';
                
                const gasValue = document.createElement('span');
                gasValue.className = 'gas-value';
                gasValue.textContent = item.gasUsed.toLocaleString();
                gasUsed.appendChild(gasValue);
                
                el.appendChild(gasUsed);
                
                if (item.recommendations && item.recommendations.length > 0) {
                  const recommendations = document.createElement('div');
                  recommendations.className = 'recommendations';
                  
                  const recTitle = document.createElement('div');
                  recTitle.className = 'recommendations-title';
                  recTitle.textContent = 'Optimization Recommendations:';
                  recommendations.appendChild(recTitle);
                  
                  const recList = document.createElement('ul');
                  item.recommendations.forEach(rec => {
                    const recItem = document.createElement('li');
                    recItem.className = 'recommendation-item';
                    recItem.textContent = rec;
                    recList.appendChild(recItem);
                  });
                  recommendations.appendChild(recList);
                  
                  el.appendChild(recommendations);
                }
                
                container.appendChild(el);
              });
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
