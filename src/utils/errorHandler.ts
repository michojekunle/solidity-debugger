/**
 * Standardized error handling with context tracking
 */
export interface ErrorContext {
  code: string;
  message: string;
  details?: string;
  timestamp?: string;
  stack?: string;
}

/**
 * Service for handling and logging errors with context
 */
export class ErrorHandler {
  private errorLog: Map<string, ErrorContext[]> = new Map();
  private readonly maxLogSize = 100; // Prevent memory leaks

  /**
   * Handle and log errors with full context
   */
  public handleError(
    code: string,
    message: string,
    details?: string,
    error?: Error
  ): ErrorContext {
    if (!code || !message) {
      console.warn(
        "[v0] Invalid error context - code and message are required"
      );
      return { code: "INVALID_ERROR", message: "Invalid error context" };
    }

    const context: ErrorContext = {
      code,
      message,
      details,
      timestamp: new Date().toISOString(),
      stack: error?.stack,
    };

    // Store error log
    if (!this.errorLog.has(code)) {
      this.errorLog.set(code, []);
    }

    const logs = this.errorLog.get(code)!;
    logs.push(context);

    // Prevent memory leaks by limiting log size
    if (logs.length > this.maxLogSize) {
      logs.shift();
    }

    // Console logging
    const logMessage = `[${context.timestamp}] ${message}${
      details ? ` - ${details}` : ""
    }`;
    console.error(`[v0] Error (${code}): ${logMessage}`);

    if (error?.stack) {
      console.error(`[v0] Stack: ${error.stack}`);
    }

    return context;
  }

  /**
   * Handle initialization errors
   */
  public handleInitializationError(
    message: string,
    error?: Error
  ): ErrorContext {
    return this.handleError(
      "INIT_ERROR",
      message,
      "Initialization failed",
      error
    );
  }

  /**
   * New method for warning-level logging
   */
  public warn(message: string, code?: string): void {
    const prefix = code ? `(${code})` : "";
    console.warn(`[v0] Warning ${prefix}: ${message}`);
  }

  /**
   * Log a message
   */
  public log(message: string): void {
    console.log(`[v0] ${message}`);
  }

  /**
   * Get error log for a specific code
   */
  public getErrorLog(code: string): ErrorContext[] {
    return this.errorLog.get(code) || [];
  }

  /**
   * Get last error for a code
   */
  public getLastError(code: string): ErrorContext | undefined {
    const logs = this.errorLog.get(code);
    return logs?.[logs.length - 1];
  }

  /**
   * Clear error log
   */
  public clearErrorLog(code?: string): void {
    if (code) {
      this.errorLog.delete(code);
    } else {
      this.errorLog.clear();
    }
  }

  /**
   * Get all errors as a report
   */
  public getErrorReport(): Record<string, ErrorContext[]> {
    return Object.fromEntries(this.errorLog);
  }
}
