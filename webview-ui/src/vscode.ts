// This file provides a typed interface for the VS Code API
// which is available in the webview via the acquireVsCodeApi function

interface VSCodeAPI {
  postMessage(message: any): void
  getState(): any
  setState(state: any): void
}

// Declare the acquireVsCodeApi function
declare function acquireVsCodeApi(): VSCodeAPI

// Create a type-safe wrapper for the VS Code API
// with a fallback for when running outside of VS Code (e.g., during development)
let vscode: VSCodeAPI

try {
  // Check if we're running in a VS Code webview
  if (typeof acquireVsCodeApi === "function") {
    vscode = acquireVsCodeApi()
  } else {
    // Fallback for when running outside of VS Code
    console.warn("Running outside of VS Code, using mock VS Code API")
    vscode = {
      postMessage: (message: any) => {
        console.log("Mock postMessage called with:", message)
      },
      getState: () => {
        return {}
      },
      setState: (state: any) => {
        console.log("Mock setState called with:", state)
      },
    }
  }
} catch (error) {
  console.error("Failed to acquire VS Code API:", error)
  // Provide a fallback implementation
  vscode = {
    postMessage: (message: any) => {
      console.log("Mock postMessage called with:", message)
    },
    getState: () => {
      return {}
    },
    setState: (state: any) => {
      console.log("Mock setState called with:", state)
    },
  }
}

export { vscode }
