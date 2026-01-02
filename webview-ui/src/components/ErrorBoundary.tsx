"use client"

import { Component, type ReactNode } from "react"

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  errorCount: number
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, errorCount: 0 }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorCount: 0 }
  }

  componentDidCatch(error: Error) {
    console.error("Error caught by boundary:", error)
    this.setState((prev) => ({
      errorCount: prev.errorCount + 1,
    }))
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      const { error, errorCount } = this.state

      // Prevent infinite error loops by showing degraded UI after 3 errors
      if (errorCount >= 3) {
        return (
          <div className="error-boundary-critical">
            <div className="error-content">
              <h2>Critical Error</h2>
              <p className="error-message">The application encountered multiple errors and may need to be restarted.</p>
              <details className="error-details">
                <summary>Error Details</summary>
                <pre>
                  {error?.message}\n{error?.stack}
                </pre>
              </details>
              <button onClick={() => window.location.reload()}>Reload Application</button>
            </div>
          </div>
        )
      }

      return (
        <div className="error-boundary">
          <div className="error-content">
            <h2>Something went wrong</h2>
            <p className="error-message">{error?.message}</p>
            <details className="error-details">
              <summary>Error Details</summary>
              <pre>{error?.stack}</pre>
            </details>
            <button onClick={this.handleReset}>Try Again</button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
