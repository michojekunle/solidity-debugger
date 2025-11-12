"use client";

import type React from "react";

interface ErrorAlertProps {
  error: { code: string; message: string };
  onDismiss: () => void;
}

const ErrorAlert: React.FC<ErrorAlertProps> = ({ error, onDismiss }) => (
  <div className="error-alert">
    <div className="error-content">
      <strong>Error ({error.code}):</strong>
      <p>{error.message}</p>
    </div>
    <button className="error-dismiss" onClick={onDismiss}>
      ×
    </button>
  </div>
);

export default ErrorAlert;
