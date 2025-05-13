import * as vscode from 'vscode';

export class StateVisualizerPanel {
    public static currentPanel: StateVisualizerPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
  
    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
      this._panel = panel;
      
      // Set the webview's initial html content
      this._panel.webview.html = this._getHtmlForWebview(this._panel.webview, extensionUri);
      
      // Listen for when the panel is disposed
      // This happens when the user closes the panel or when the panel is closed programmatically
      this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
      
      // Set up message handlers
      this.setupMessageHandlers();
    }
  
    public static createOrShow(extensionUri: vscode.Uri) {
      const column = vscode.window.activeTextEditor
        ? vscode.window.activeTextEditor.viewColumn
        : undefined;
        
      // If we already have a panel, show it
      if (StateVisualizerPanel.currentPanel) {
        StateVisualizerPanel.currentPanel._panel.reveal(column);
        return;
      }
      
      // Otherwise, create a new panel
      const panel = vscode.window.createWebviewPanel(
        'stateVisualizer',
        'Solidity State Visualizer',
        column || vscode.ViewColumn.One,
        {
          // Enable scripts in the webview
          enableScripts: true,
          
          // Restrict the webview to only load resources from the `media` directory
          localResourceRoots: [
            vscode.Uri.joinPath(extensionUri, 'media'),
            vscode.Uri.joinPath(extensionUri, 'webview-ui/build')
          ],
          
          // Retain context when the panel goes into the background
          retainContextWhenHidden: true
        }
      );
      
      StateVisualizerPanel.currentPanel = new StateVisualizerPanel(panel, extensionUri);
    }
  
    private setupMessageHandlers() {
      // Handle messages from the webview
      this._panel.webview.onDidReceiveMessage(
        message => {
          switch (message.command) {
            case 'getStateChanges':
              // Get the current state changes and send them to the webview
              const stateChanges = StateVisualizerPanel.getStateChanges();
              this._panel.webview.postMessage({
                command: 'updateStateChanges',
                stateChanges
              });
              break;
          }
        },
        null,
        this._disposables
      );
    }
  
    private static getStateChanges() {
      // This would get the state changes from the state collector
      // For demonstration, we're using mock data
      return [
        {
          address: '0x1234567890123456789012345678901234567890',
          slot: '0x0',
          oldValue: '0x0',
          newValue: '0x64',
          variableName: 'totalSupply',
          typeInfo: 'uint256'
        }
      ];
    }
  
    private _getHtmlForWebview(webview: vscode.Webview, extensionUri: vscode.Uri) {
      // Get the local path to index script run in the webview
      const scriptPathOnDisk = vscode.Uri.joinPath(extensionUri, 'webview-ui', 'build', 'assets', 'index.js');
      const scriptUri = webview.asWebviewUri(scriptPathOnDisk);
      
      // Use a nonce to only allow specific scripts to be run
      const nonce = getNonce();
      
      return `<!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Solidity State Visualizer</title>
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
            .state-container {
              display: flex;
              flex-direction: column;
              gap: 10px;
            }
            .state-change {
              background-color: white;
              border: 1px solid #ddd;
              border-radius: 4px;
              padding: 10px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .variable-name {
              font-weight: bold;
              color: #0078D7;
            }
            .values {
              display: flex;
              justify-content: space-between;
              margin-top: 5px;
            }
            .old-value, .new-value {
              padding: 5px;
              border-radius: 3px;
              font-family: monospace;
            }
            .old-value {
              background-color: #FFEBEE;
              color: #D32F2F;
            }
            .new-value {
              background-color: #E8F5E9;
              color: #388E3C;
            }
            .type-info {
              font-size: 12px;
              color: #666;
              margin-top: 5px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="title">Solidity State Visualizer</div>
            <div id="state-changes" class="state-container">
              <!-- State changes will be rendered here -->
              <div class="state-change">
                <div class="variable-name">loading...</div>
              </div>
            </div>
          </div>
          
          <script nonce="${nonce}">
            const vscode = acquireVsCodeApi();
            
            // Setup event listener to receive messages from the extension
            window.addEventListener('message', event => {
              const message = event.data;
              
              switch (message.command) {
                case 'updateStateChanges':
                  renderStateChanges(message.stateChanges);
                  break;
              }
            });
            
            // Request initial state changes
            vscode.postMessage({
              command: 'getStateChanges'
            });
            
            function renderStateChanges(stateChanges) {
              const container = document.getElementById('state-changes');
              container.innerHTML = '';
              
              if (stateChanges.length === 0) {
                container.innerHTML = '<div class="state-change">No state changes detected.</div>';
                return;
              }
              
              stateChanges.forEach(change => {
                const el = document.createElement('div');
                el.className = 'state-change';
                
                const varName = document.createElement('div');
                varName.className = 'variable-name';
                varName.textContent = change.variableName || change.slot;
                el.appendChild(varName);
                
                const values = document.createElement('div');
                values.className = 'values';
                
                const oldValue = document.createElement('div');
                oldValue.className = 'old-value';
                oldValue.textContent = change.oldValue;
                values.appendChild(oldValue);
                
                const newValue = document.createElement('div');
                newValue.className = 'new-value';
                newValue.textContent = change.newValue;
                values.appendChild(newValue);
                
                el.appendChild(values);
                
                if (change.typeInfo) {
                  const typeInfo = document.createElement('div');
                  typeInfo.className = 'type-info';
                  typeInfo.textContent = change.typeInfo;
                  el.appendChild(typeInfo);
                }
                
                container.appendChild(el);
              });
            }
          </script>
        </body>
        </html>`;
    }
  
    public dispose() {
      // Clean up resources
      StateVisualizerPanel.currentPanel = undefined;
      
      // Dispose of all disposables (i.e. commands) associated with this panel
      while (this._disposables.length) {
        const disposable = this._disposables.pop();
        if (disposable) {
          disposable.dispose();
        }
      }
      
      this._panel.dispose();
    }
  }
  
  function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }