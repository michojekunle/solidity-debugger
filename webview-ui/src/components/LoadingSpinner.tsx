import type React from "react"
import { VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react"

interface LoadingSpinnerProps {
  message?: string
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message = "Loading..." }) => (
  <div className="loading-container">
    <VSCodeProgressRing />
    <p>{message}</p>
  </div>
)

export default LoadingSpinner
