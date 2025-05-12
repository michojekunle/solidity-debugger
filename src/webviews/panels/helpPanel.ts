import * as vscode from "vscode";

export class HelpPanel {
  public static currentPanel: HelpPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;

    // Set the webview's initial html content
    this._panel.webview.html = this._getHtmlForWebview(
      this._panel.webview,
      extensionUri
    );

    // Listen for when the panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Set up message handlers
    this.setupMessageHandlers();
  }

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it
    if (HelpPanel.currentPanel) {
      HelpPanel.currentPanel._panel.reveal(column);
      return;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      "helpPanel",
      "Solidity Help & Resources",
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, "media"),
          vscode.Uri.joinPath(extensionUri, "webview-ui/build"),
        ],
        retainContextWhenHidden: true,
      }
    );

    HelpPanel.currentPanel = new HelpPanel(panel, extensionUri);
  }

  private setupMessageHandlers() {
    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case "getHelpContent":
            // Get the help content and send it to the webview
            const helpContent = HelpPanel.getHelpContent(message.key);
            this._panel.webview.postMessage({
              command: "updateHelpContent",
              helpContent,
            });
            break;
        }
      },
      null,
      this._disposables
    );
  }

  private static getHelpContent(key: string) {
    // This would get the help content from the educational content service
    // For demonstration, we're using mock data
    console.log(`Fetching help content for key: ${key}`);
    const helpContent = {
      key: "storage-optimization",
      title: "Storage Optimization",
      content:
        "Ethereum storage is expensive. Each storage slot costs 20,000 gas to initialize " +
        "and 5,000 gas to update. You can optimize by packing multiple variables into a " +
        "single storage slot, using smaller types, and using memory for temporary values.",
      relatedLinks: [
        {
          title: "Solidity Storage Layout",
          url: "https://docs.soliditylang.org/en/latest/internals/layout_in_storage.html",
        },
        {
          title: "Gas Optimization Techniques",
          url: "https://ethereum.org/en/developers/tutorials/gas-optimization-techniques/",
        },
      ],
    };

    return helpContent;
  }

  private _getHtmlForWebview(
    webview: vscode.Webview,
    extensionUri: vscode.Uri
  ): string {

    console.log("Webview URI: ", webview.asWebviewUri(extensionUri));
    const nonce = getNonce();

    return `<!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Solidity Help & Resources</title>
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
            .help-content {
              background-color: white;
              border: 1px solid #ddd;
              border-radius: 4px;
              padding: 15px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .help-title {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 10px;
              color: #0078D7;
            }
            .help-text {
              line-height: 1.5;
              margin-bottom: 15px;
            }
            .related-links {
              margin-top: 20px;
            }
            .related-title {
              font-weight: bold;
              margin-bottom: 10px;
            }
            .link-item {
              margin-bottom: 5px;
            }
            .topic-selector {
              margin-bottom: 20px;
            }
            select {
              padding: 5px;
              border-radius: 4px;
              border: 1px solid #ddd;
              font-size: 14px;
              width: 100%;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="title">Solidity Help & Resources</div>
            
            <div class="topic-selector">
              <select id="topic-select">
                <option value="">Select a topic</option>
                <option value="storage-optimization">Storage Optimization</option>
                <option value="reentrancy">Reentrancy Protection</option>
                <option value="gas-estimation">Gas Estimation</option>
                <option value="debugging-tips">Debugging Tips</option>
              </select>
            </div>
            
            <div id="help-content" class="help-content">
              <div class="help-title">Select a topic to see help content</div>
            </div>
          </div>
          
          <script nonce="${nonce}">
            const vscode = acquireVsCodeApi();
            const topicSelect = document.getElementById('topic-select');
            
            // Handle topic selection
            topicSelect.addEventListener('change', () => {
              const key = topicSelect.value;
              if (key) {
                vscode.postMessage({
                  command: 'getHelpContent',
                  key
                });
              }
            });
            
            // Setup event listener to receive messages from the extension
            window.addEventListener('message', event => {
              const message = event.data;
              
              switch (message.command) {
                case 'updateHelpContent':
                  renderHelpContent(message.helpContent);
                  break;
              }
            });
            
            function renderHelpContent(content) {
              const container = document.getElementById('help-content');
              
              if (!content) {
                container.innerHTML = '<div class="help-title">No help content available for this topic</div>';
                return;
              }
              
              let html = '<div class="help-title">content.title</div><div class="help-text">content.content</div>';
              
              if (content.relatedLinks && content.relatedLinks.length > 0) {
                html += '<div class="related-links"><div class="related-title">Related Resources:</div><ul>';
                
                content.relatedLinks.forEach(link => {
                  html += '<li class="link-item"><a href="link.url" target="_blank">link.title</a></li>';
                });
                
                html += '</ul></div>';
              }
              
              container.innerHTML = html;
            }
          </script>
        </body>
        </html>`;
  }

  public dispose() {
    HelpPanel.currentPanel = undefined;

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
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
