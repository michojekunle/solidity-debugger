
import { vi } from "vitest"

export const window = {
  activeTextEditor: {
    document: {
      uri: { fsPath: "/mock/path/Contract.sol" },
      getText: () => "contract Mock {}",
      languageId: "solidity"
    }
  },
  showErrorMessage: vi.fn(),
  showInformationMessage: vi.fn(),
  showWarningMessage: vi.fn(),
  createWebviewPanel: vi.fn(() => ({
      webview: { html: "", onDidReceiveMessage: vi.fn(), postMessage: vi.fn(), asWebviewUri: vi.fn(uri => uri) },
      onDidDispose: vi.fn(),
      reveal: vi.fn(),
      dispose: vi.fn()
  })),
  createOutputChannel: vi.fn(() => ({ 
      appendLine: vi.fn(), 
      show: vi.fn(), 
      dispose: vi.fn() 
  })),
}

export const workspace = {
  workspaceFolders: [{ uri: { fsPath: "/mock/workspace" } }],
  findFiles: vi.fn(() => []),
  getConfiguration: vi.fn(() => ({
      get: vi.fn(),
      update: vi.fn()
  }))
}

export const Uri = {
  file: (path: string) => ({ fsPath: path, scheme: "file" }),
  parse: (path: string) => ({ fsPath: path, scheme: "file" }),
  joinPath: (base: any, ...args: string[]) => ({ fsPath: base.fsPath + "/" + args.join("/") })
}

export const Range = vi.fn()
export const Position = vi.fn()

export class EventEmitter {
  event = vi.fn()
  fire = vi.fn()
  dispose = vi.fn()
}

export const Disposable = {
  from: vi.fn(),
  dispose: vi.fn() // Add dispose if needed
}

export const ViewColumn = {
  One: 1,
  Two: 2
}
