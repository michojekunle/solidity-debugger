import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

/**
 * Interface representing state change data
 */
export interface StateChange {
  address: string;
  slot: string;
  oldValue: string;
  newValue: string;
  variableName?: string;
  typeInfo?: string;
  timestamp?: number;
  functionName?: string;
  txHash?: string;
}

/**
 * Controller for the State Visualization WebView panel
 */
export class StateWebviewController {
  public static currentPanel: StateWebviewController | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  /**
   * Get the static HTML content for the webview
   */
  private static getWebviewContent(
    webview: vscode.Webview,
    extensionUri: vscode.Uri
  ): string {
    // Local path to the webview bundle
    const webviewPath = path.join(extensionUri.fsPath, "webview-ui", "out");

    // Check if we're running in development mode
    const devMode = process.env.NODE_ENV === "development";

    // In dev mode, use the local server
    if (devMode) {
      return `<!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Solidity Debugger</title>
          <script>
            // Redirect all fetch requests to the local dev server
            const originalFetch = window.fetch;
            window.fetch = function(url, options) {
              if (url.startsWith('/')) {
                return originalFetch('http://localhost:3000' + url, options);
              }
              return originalFetch(url, options);
            }
          </script>
        </head>
        <body>
          <div id="root"></div>
          <script src="http://localhost:3000/src/main.tsx" type="module"></script>
        </body>
        </html>`;
    }

    // Check if the webview bundle exists
    if (!fs.existsSync(webviewPath)) {
      return `
        <html>
          <body>
            <h1>Error: Webview bundle not found</h1>
            <p>Please build the webview bundle by running:</p>
            <pre>cd webview-ui && npm run build</pre>
          </body>
        </html>
      `;
    }

    // Path to the main.js file
    const scriptPath = vscode.Uri.joinPath(
      extensionUri,
      "webview-ui",
      "out",
      "assets",
      "main.js"
    );
    const scriptUri = webview.asWebviewUri(scriptPath);

    // Path to CSS file
    const cssPath = vscode.Uri.joinPath(
      extensionUri,
      "webview-ui",
      "out",
      "assets",
      "main.css"
    );
    const cssUri = webview.asWebviewUri(cssPath);

    // Use a nonce to allow only specific scripts to run
    const nonce = getNonce();

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src ${webview.cspSource};">
        <title>Solidity Debugger</title>
        <link rel="stylesheet" type="text/css" href="${cssUri}">
      </head>
      <body>
        <div id="root"></div>
        <script nonce="${nonce}" src="${scriptUri}"></script>
      </body>
      </html>`;
  }

  /**
   * Create or reveal the WebView panel
   */
  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it
    if (StateWebviewController.currentPanel) {
      StateWebviewController.currentPanel._panel.reveal(column);
      return;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      "solidityDebuggerState",
      "Solidity State Visualization",
      column || vscode.ViewColumn.One,
      {
        // Enable JavaScript in the webview
        enableScripts: true,
        // Restrict the webview to only load resources from the extension's directory
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, "webview-ui", "out"),
          vscode.Uri.joinPath(extensionUri, "media"),
        ],
        // Keep the webview alive in the background
        retainContextWhenHidden: true,
      }
    );

    StateWebviewController.currentPanel = new StateWebviewController(
      panel,
      extensionUri
    );
  }

  /**
   * Create a new WebView controller
   */
  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    // Set the webview's initial html content
    this._update();

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programmatically
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Update the content based on view changes
    this._panel.onDidChangeViewState(
      (e) => {
        if (this._panel.visible) {
          this._update();
        }
      },
      null,
      this._disposables
    );

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.type) {
          case "ready":
            // WebView is ready to receive data
            // Send any initial data here
            break;
          case "requestDetail":
            // Handle request for detail information
            this._sendDetailData(message.address, message.slot);
            break;
        }
      },
      null,
      this._disposables
    );
  }

  /**
   * Send state changes data to the webview
   */
  public sendStateChanges(
    stateChanges: StateChange[],
    txHash?: string,
    contractName?: string,
    functionName?: string
  ) {
    if (this._panel.visible) {
      this._panel.webview.postMessage({
        type: "stateChanges",
        data: {
          stateChanges,
          txHash,
          contractName,
          functionName,
        },
      });
    }
  }

  /**
   * Send error message to the webview
   */
  public sendError(message: string) {
    if (this._panel.visible) {
      this._panel.webview.postMessage({
        type: "error",
        message,
      });
    }
  }

  /**
   * Clean up resources when the panel is closed
   */
  public dispose() {
    StateWebviewController.currentPanel = undefined;

    // Clean up our resources
    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  /**
   * Update the webview content
   */
  private _update() {
    const webview = this._panel.webview;
    this._panel.webview.html = StateWebviewController.getWebviewContent(
      webview,
      this._extensionUri
    );
  }

  /**
   * Send detailed information about a specific storage slot
   */
  private _sendDetailData(address: string, slot: string) {
    // This would typically involve looking up detailed information
    // about the specified storage slot from your state tracker
    // For now, we'll just send back the request data
    this._panel.webview.postMessage({
      type: "detailData",
      data: {
        address,
        slot,
        // Include more detailed data here
      },
    });
  }
}

/**
 * Generate a nonce for Content Security Policy
 */
function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
