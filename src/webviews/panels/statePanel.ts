import * as vscode from "vscode"
import type { StateProcessorService } from "../../extension"

export class StateVisualizerPanel {
  public static currentPanel: StateVisualizerPanel | undefined
  private readonly _panel: vscode.WebviewPanel
  private _disposables: vscode.Disposable[] = []
  private _stateProcessorService: StateProcessorService | undefined

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    stateProcessorService?: StateProcessorService,
  ) {
    this._panel = panel
    this._stateProcessorService = stateProcessorService

    // Set the webview's initial html content
    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview, extensionUri)

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programmatically
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables)

    // Set up message handlers
    this.setupMessageHandlers()
  }

  public static createOrShow(extensionUri: vscode.Uri, stateProcessorService?: StateProcessorService) {
    const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined

    // If we already have a panel, show it
    if (StateVisualizerPanel.currentPanel) {
      StateVisualizerPanel.currentPanel._panel.reveal(column)
      return
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
      },
    )

    StateVisualizerPanel.currentPanel = new StateVisualizerPanel(panel, extensionUri, stateProcessorService)
  }

  private setupMessageHandlers() {
    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case "getStateChanges":
            // Get the current state changes and send them to the webview
            this.sendStateChangesToWebview()
            break

          case "getContractInfo":
            // Get contract info and send to webview
            this.sendContractInfoToWebview()
            break

          case "analyzeContract":
            // Trigger contract analysis
            if (this._stateProcessorService) {
              await this._stateProcessorService.analyzeContractState()
            } else {
              // Fallback if service is not available
              const stateChanges = StateVisualizerPanel.getStateChanges()
              this._panel.webview.postMessage({
                command: "updateStateChanges",
                stateChanges,
              })
            }
            break

          case "executeContractFunction":
            // Execute a contract function in the simulator
            if (this._stateProcessorService) {
              const result = await this._stateProcessorService.simulateContractFunction(
                message.functionName,
                message.inputs,
                message.currentState,
              )

              // Send the result back to the webview
              this._panel.webview.postMessage({
                command: "functionExecuted",
                stateChanges: result.stateChanges,
                newState: result.newState,
              })
            }
            break
        }
      },
      null,
      this._disposables,
    )

    // If we have a state processor service, listen for state updates
    if (this._stateProcessorService) {
      // Listen for state updates
      this._disposables.push(
        this._stateProcessorService.onStateUpdated((stateUpdate) => {
          // When state is updated, send the changes to the webview
          this.sendStateChangesToWebview(stateUpdate)
        }),
      )

      // Listen for contract analysis
      this._disposables.push(
        this._stateProcessorService.onContractAnalyzed((contractInfo) => {
          // When a contract is analyzed, send the info to the webview
          this.sendContractInfoToWebview(contractInfo)
        }),
      )
    }
  }

  private sendStateChangesToWebview(stateUpdate?: any) {
    let stateChanges
    let contractState

    if (stateUpdate) {
      // If we have a state update from the service, use it
      stateChanges = this.transformStateUpdateToChanges(stateUpdate)
      contractState = stateUpdate.currentState
    } else if (this._stateProcessorService) {
      // Otherwise try to get the current state from the service
      const snapshots = this._stateProcessorService.getSnapshots?.()
      if (snapshots && snapshots.length > 0) {
        // Collect all changes from all snapshots
        stateChanges = snapshots.flatMap((snapshot) => snapshot.changes)
      } else {
        // Fallback to mock data
        stateChanges = StateVisualizerPanel.getStateChanges()
      }

      // Get the current contract state
      contractState = this._stateProcessorService.getCurrentState?.() || {}
    } else {
      // Fallback to mock data if no service is available
      stateChanges = StateVisualizerPanel.getStateChanges()
      contractState = {}
    }

    // Send the state changes to the webview
    this._panel.webview.postMessage({
      command: "updateStateChanges",
      stateChanges,
    })

    // Send the current contract state
    this._panel.webview.postMessage({
      command: "updateContractState",
      contractState,
    })
  }

  private sendContractInfoToWebview(contractInfo?: any) {
    if (contractInfo) {
      // If we have contract info from an event, use it
      this._panel.webview.postMessage({
        command: "contractAnalyzed",
        contractName: contractInfo.contractName,
        contractFunctions: this.extractFunctionsFromAbi(contractInfo.abi),
        storageVariables: this.extractStorageVariables(contractInfo.storageLayout),
      })
    } else if (this._stateProcessorService) {
      
      // Otherwise try to get the current contract info from the service
      const contractName = this._stateProcessorService.getCurrentContractName?.() || "Unknown Contract"
      const abi = this._stateProcessorService.getCurrentContractAbi?.() || []
      const storageVariables = this._stateProcessorService.getStorageVariables?.() || []

      this._panel.webview.postMessage({
        command: "contractAnalyzed",
        contractName,
        contractFunctions: this.extractFunctionsFromAbi(abi),
        storageVariables,
      })
    } else {
      // Fallback to mock data if no service is available
      this._panel.webview.postMessage({
        command: "contractAnalyzed",
        contractName: "Mock Contract",
        contractFunctions: [],
        storageVariables: [],
      })
    }
  }

  private extractFunctionsFromAbi(abi: any[]): any[] {
    if (!abi || !Array.isArray(abi)) {
      return []
    }

    return abi
      .filter((item) => item.type === "function")
      .map((func) => ({
        name: func.name,
        inputs: func.inputs || [],
        outputs: func.outputs || [],
        stateMutability: func.stateMutability || "nonpayable",
      }))
  }

  private extractStorageVariables(storageLayout: any): any[] {
    if (!storageLayout || !storageLayout.storage) {
      return []
    }

    return storageLayout.storage.map((item: any) => ({
      slot: "0x" + Number.parseInt(item.slot).toString(16),
      name: item.label,
      type: item.type,
      offset: item.offset || 0,
    }))
  }

  private transformStateUpdateToChanges(stateUpdate: any): any[] {
    // Transform the state update into the format expected by the webview
    if (stateUpdate.history && stateUpdate.currentStep >= 0) {
      // If we have history and a current step, use the changes from that snapshot
      return stateUpdate.history[stateUpdate.currentStep]?.changes || []
    }

    // If we have all snapshots, collect all changes
    if (stateUpdate.history) {
      return stateUpdate.history.flatMap((snapshot: any) => snapshot.changes)
    }

    // If we have current state but no history, transform it to changes format
    if (stateUpdate.currentState) {
      const changes = []

      for (const [key, value] of Object.entries(stateUpdate.currentState)) {
        const stateValue = value as any
        changes.push({
          slot: stateValue.slot || "0x0",
          oldValue: stateValue.previousValue || "0x0",
          newValue: stateValue.value || "0x0",
          variableName: key,
          typeInfo: stateValue.type || "unknown",
          operation: stateValue.operation || "UNKNOWN",
        })
      }

      return changes
    }

    return []
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
    ]
  }

  // Update the HTML generation to properly declare acquireVsCodeApi
  private _getHtmlForWebview(webview: vscode.Webview, extensionUri: vscode.Uri) {
    // Get paths to the bundled React app
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, "webview-ui", "build", "assets", "index.js"),
    )

    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, "webview-ui", "build", "assets", "index.css"),
    )

    // Use a nonce to only allow specific scripts to be run
    const nonce = getNonce()

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
        <script nonce="${nonce}" src="${scriptUri}"></script>
      </body>
      </html>`
  }

  public dispose() {
    // Clean up resources
    StateVisualizerPanel.currentPanel = undefined

    // Dispose of all disposables (i.e. commands) associated with this panel
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
