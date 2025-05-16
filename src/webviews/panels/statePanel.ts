import * as vscode from "vscode";
import { StateProcessorService } from "../../extension";

export class StateVisualizerPanel {
  public static currentPanel: StateVisualizerPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _stateProcessorService: StateProcessorService | undefined;

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    stateProcessorService?: StateProcessorService
  ) {
    this._panel = panel;
    this._stateProcessorService = stateProcessorService;

    // Set the webview's initial html content
    this._panel.webview.html = this._getHtmlForWebview(
      this._panel.webview,
      extensionUri
    );

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programmatically
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Set up message handlers
    this.setupMessageHandlers();
  }

  public static createOrShow(
    extensionUri: vscode.Uri,
    stateProcessorService?: StateProcessorService
  ) {
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
      "stateVisualizer",
      "Solidity State Visualizer",
      column || vscode.ViewColumn.One,
      {
        // Enable scripts in the webview
        enableScripts: true,

        // Restrict the webview to only load resources from the `media` and `webview-ui/build` directories
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, "media"),
          vscode.Uri.joinPath(extensionUri, "webview-ui", "build"),
        ],

        // Retain context when the panel goes into the background
        retainContextWhenHidden: true,
      }
    );

    StateVisualizerPanel.currentPanel = new StateVisualizerPanel(
      panel,
      extensionUri,
      stateProcessorService
    );
  }

  private setupMessageHandlers() {
    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case "getStateChanges":
            // Get the current state changes and send them to the webview
            this.sendStateChangesToWebview();
            break;

          case "analyzeContract":
            // Trigger contract analysis
            if (this._stateProcessorService) {
              await this._stateProcessorService.analyzeContractState();
              this.sendStateChangesToWebview();
            } else {
              // Fallback if service is not available
              const stateChanges = StateVisualizerPanel.getStateChanges();
              this._panel.webview.postMessage({
                command: "updateStateChanges",
                stateChanges,
              });
            }
            break;
        }
      },
      null,
      this._disposables
    );

    // If we have a state processor service, listen for state updates
    if (this._stateProcessorService) {
      this._disposables.push(
        this._stateProcessorService.onStateUpdated((stateUpdate) => {
          // When state is updated, send the changes to the webview
          this.sendStateChangesToWebview(stateUpdate);
        })
      );
    }
  }

  private sendStateChangesToWebview(stateUpdate?: any) {
    let stateChanges;

    if (stateUpdate) {
      // If we have a state update from the service, use it
      stateChanges = this.transformStateUpdateToChanges(stateUpdate);
    } else if (this._stateProcessorService) {
      // Otherwise try to get the current state from the service
      const snapshots = this._stateProcessorService.getSnapshots?.();
      if (snapshots && snapshots.length > 0) {
        // Use the most recent snapshot
        stateChanges = snapshots[snapshots.length - 1].changes;
      } else {
        // Fallback to mock data
        stateChanges = StateVisualizerPanel.getStateChanges();
      }
    } else {
      // Fallback to mock data if no service is available
      stateChanges = StateVisualizerPanel.getStateChanges();
    }

    // Send the state changes to the webview
    this._panel.webview.postMessage({
      command: "updateStateChanges",
      stateChanges,
    });
  }

  private transformStateUpdateToChanges(stateUpdate: any): any[] {
    // Transform the state update into the format expected by the webview
    if (stateUpdate.history && stateUpdate.currentStep >= 0) {
      // If we have history and a current step, use the changes from that snapshot
      return stateUpdate.history[stateUpdate.currentStep]?.changes || [];
    }

    // If we have current state but no history, transform it to changes format
    if (stateUpdate.currentState) {
      const changes = [];

      for (const [key, value] of Object.entries(stateUpdate.currentState)) {
        const stateValue = value as any;
        changes.push({
          slot: stateValue.slot || "0x0",
          oldValue: stateValue.previousValue || "0x0",
          newValue: stateValue.value || "0x0",
          variableName: key,
          typeInfo: stateValue.type || "unknown",
          operation: stateValue.operation || "UNKNOWN",
        });
      }

      return changes;
    }

    return [];
  }

  private static getStateChanges() {
    // This would get the state changes from the state collector
    // For demonstration, we're using mock data
    return [
      {
        slot: "0x0",
        oldValue: "0x0",
        newValue: "0x64",
        variableName: "totalSupply",
        typeInfo: "uint256",
        operation: "SSTORE",
        pc: 123,
        depth: 1,
      },
      {
        slot: "0x1",
        oldValue: "0x0",
        newValue: "0x1",
        variableName: "initialized",
        typeInfo: "bool",
        operation: "SSTORE",
        pc: 145,
        depth: 1,
      },
      {
        slot: "0x2",
        oldValue: "0x0",
        newValue: "0xa",
        variableName: "decimals",
        typeInfo: "uint8",
        operation: "SSTORE",
        pc: 167,
        depth: 1,
      },
    ];
  }

  private _getHtmlForWebview(
    webview: vscode.Webview,
    extensionUri: vscode.Uri
  ) {
    // Get paths to the bundled React app
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        extensionUri,
        "webview-ui",
        "build",
        "assets",
        "index.js"
      )
    );

    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        extensionUri,
        "webview-ui",
        "build",
        "assets",
        "index.css"
      )
    );

    // Use a nonce to only allow specific scripts to be run
    const nonce = getNonce();

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https:;">
        <title>Solidity State Visualizer</title>
        <link href="${styleUri}" rel="stylesheet">
      </head>
      <body>
        <div id="root"></div>
        <script nonce="${nonce}">
          // This is critical - declare the acquireVsCodeApi function before loading React
          const vscode = acquireVsCodeApi();
        </script>
        <script nonce="${nonce}" src="${scriptUri}"></script>
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
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
