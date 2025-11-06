"use client";

import type React from "react";
import { useState, useCallback } from "react";
import {
  VSCodeButton,
  VSCodeTextField,
  VSCodeDropdown,
  VSCodeOption,
  VSCodeDivider,
} from "@vscode/webview-ui-toolkit/react";
import type { ContractFunction, ContractState } from "../types";
import { vscode } from "../vscode";

interface ContractSimulatorProps {
  contractFunctions: ContractFunction[];
  currentState: ContractState;
  onExecuting?: (executing: boolean) => void;
}

const ContractSimulator: React.FC<ContractSimulatorProps> = ({
  contractFunctions,
  currentState,
  onExecuting,
}) => {
  const [selectedFunction, setSelectedFunction] =
    useState<ContractFunction | null>(null);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const handleFunctionSelect = useCallback(
    (event: any) => {
      const funcName = event.target.value;
      const func = contractFunctions.find((f) => f.name === funcName) || null;
      setSelectedFunction(func);
      setExecutionResult(null);
      setLastError(null);

      if (func) {
        const initialInputs: Record<string, string> = {};
        func.inputs.forEach((input) => {
          initialInputs[input.name] = "";
        });
        setInputValues(initialInputs);
      } else {
        setInputValues({});
      }
    },
    [contractFunctions]
  );

  const handleInputChange = useCallback((name: string, value: string) => {
    setInputValues((prev) => ({
      ...prev,
      [name]: value,
    }));
    setLastError(null);
  }, []);

  const validateInputs = (): boolean => {
    if (!selectedFunction) {
      setLastError("No function selected");
      return false;
    }

    for (const input of selectedFunction.inputs) {
      const value = inputValues[input.name];

      if (!value) {
        setLastError(`Missing required input: ${input.name}`);
        return false;
      }

      // Type-specific validation
      if (input.type.includes("uint") || input.type.includes("int")) {
        if (!/^-?\d+$/.test(value)) {
          setLastError(`${input.name} must be a valid number`);
          return false;
        }
      } else if (input.type === "address") {
        if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
          setLastError(
            `${input.name} must be a valid Ethereum address (0x...)`
          );
          return false;
        }
      } else if (input.type === "bool") {
        if (!["true", "false", "0", "1"].includes(value.toLowerCase())) {
          setLastError(`${input.name} must be true, false, 0, or 1`);
          return false;
        }
      }
    }

    return true;
  };

  const executeFunction = useCallback(() => {
    if (!validateInputs()) {
      return;
    }

    if (!selectedFunction) return;

    setIsExecuting(true);
    setExecutionResult(null);
    setLastError(null);
    onExecuting?.(true);

    try {
      // Format inputs based on their types
      const formattedInputs = selectedFunction.inputs.map((input) => {
        const value = inputValues[input.name] || "";

        if (input.type.includes("int")) {
          return value === "" ? "0" : value;
        } else if (input.type === "address") {
          return value.startsWith("0x") ? value : `0x${value}`;
        } else if (input.type === "bool") {
          return value.toLowerCase() === "true" || value === "1";
        } else {
          return value;
        }
      });

      // Send message to extension
      vscode.postMessage({
        command: "executeContractFunction",
        functionName: selectedFunction.name,
        inputs: formattedInputs,
        currentState: currentState,
      });

      setExecutionResult(`Executing ${selectedFunction.name}...`);

      // Reset after delay
      setTimeout(() => {
        setIsExecuting(false);
        onExecuting?.(false);
      }, 2000);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      setLastError(`Execution error: ${errorMsg}`);
      setIsExecuting(false);
      onExecuting?.(false);
    }
  }, [selectedFunction, inputValues, currentState, onExecuting]);

  return (
    <div className="contract-simulator">
      <h2>Contract Simulator</h2>
      <p>Select a function and provide inputs to simulate contract execution</p>

      <div className="function-selector">
        <VSCodeDropdown
          onChange={handleFunctionSelect}
          value={selectedFunction?.name || ""}
        >
          <VSCodeOption value="">Select a function...</VSCodeOption>
          {contractFunctions.map((func) => (
            <VSCodeOption key={func.name} value={func.name}>
              {func.name}
              {func.stateMutability === "view" ? " (view)" : ""}
              {func.stateMutability === "pure" ? " (pure)" : ""}
            </VSCodeOption>
          ))}
        </VSCodeDropdown>
      </div>

      {lastError && (
        <div className="error-message">
          <strong>⚠️ Error:</strong> {lastError}
        </div>
      )}

      {selectedFunction && (
        <div className="function-inputs">
          <h3>{selectedFunction.name}</h3>
          {selectedFunction.inputs.length > 0 ? (
            <>
              {selectedFunction.inputs.map((input) => (
                <div className="input-field" key={input.name}>
                  <VSCodeTextField
                    placeholder={`${input.type}`}
                    value={inputValues[input.name] || ""}
                    onChange={(e: any) =>
                      handleInputChange(input.name, e.target.value)
                    }
                    disabled={isExecuting}
                  >
                    {input.name} ({input.type})
                  </VSCodeTextField>
                </div>
              ))}
            </>
          ) : (
            <p>This function takes no inputs</p>
          )}

          <div className="execute-button">
            <VSCodeButton
              onClick={executeFunction}
              disabled={isExecuting || !selectedFunction}
            >
              {isExecuting ? "Executing..." : "Execute Function"}
            </VSCodeButton>
          </div>

          {executionResult && (
            <div className="execution-status">
              <p>{executionResult}</p>
            </div>
          )}

          <VSCodeDivider />

          <div className="function-info">
            <p>
              <strong>State Mutability:</strong>{" "}
              {selectedFunction.stateMutability}
            </p>
            {selectedFunction.outputs.length > 0 && (
              <div>
                <strong>Returns:</strong>
                <ul>
                  {selectedFunction.outputs.map((output, index) => (
                    <li key={index}>
                      {output.name ? `${output.name}: ` : ""}
                      {output.type}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractSimulator;
