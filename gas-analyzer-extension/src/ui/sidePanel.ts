// src/ui/sidePanel.ts
import * as vscode from 'vscode';
import * as path from 'path';

export class SidePanelProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(webviewView: vscode.WebviewView): void {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        
        // Handle messages from webview
        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'applyOptimization':
                    this.applyOptimization(data.optimization);
                    break;
                case 'requestGasAnalysis':
                    this.sendGasAnalysis();
                    break;
            }
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'webview', 'dist', 'bundle.js')
        );

        return `<!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Gas Optimizer</title>
            </head>
            <body>
                <div id="root"></div>
                <script src="${scriptUri}"></script>
            </body>
            </html>`;
    }

    public updateGasData(gasData: any): void {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'gasDataUpdate',
                data: gasData
            });
        }
    }
}