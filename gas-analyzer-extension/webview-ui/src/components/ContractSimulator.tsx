"use client"

import type React from "react"

import { useState } from "react"
import {
  VSCodeButton,
  VSCodeTextField,
  VSCodeDropdown,
  VSCodeOption,
  VSCodeDivider,
} from "@vscode/webview-ui-toolkit/react"
import type { ContractFunction, ContractState } from "../types"
import { vscode } from "../vscode"

interface ContractSimulatorProps {
  contractFunctions: ContractFunction[]
  currentState: ContractState
}

const ContractSimulator: React.FC<ContractSimulatorProps> = ({ contractFunctions, currentState }) => {
  const [selectedFunction, setSelectedFunction] = useState<ContractFunction | null>(null)
  const [inputValues, setInputValues] = useState<Record<string, string>>({})
  const [isExecuting, setIsExecuting] = useState(false)

  const handleFunctionSelect = (event: any) => {
    const funcName = event.target.value
    const func = contractFunctions.find((f) => f.name === funcName) || null
    setSelectedFunction(func)

    // Reset input values when changing functions
    if (func) {
      const initialInputs: Record<string, string> = {}
      func.inputs.forEach((input) => {
        initialInputs[input.name] = ""
      })
      setInputValues(initialInputs)
    } else {
      setInputValues({})
    }
  }

  const handleInputChange = (name: string, value: string) => {
    setInputValues((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const executeFunction = () => {
    if (!selectedFunction) return

    setIsExecuting(true)

    // Format inputs based on their types
    const formattedInputs = selectedFunction.inputs.map((input) => {
      const value = inputValues[input.name] || ""

      // Format based on type
      if (input.type.includes("int")) {
        // For integers, ensure they're properly formatted
        return value === "" ? "0" : value
      } else if (input.type === "address") {
        // For addresses, ensure they have 0x prefix
        return value.startsWith("0x") ? value : `0x${value}`
      } else if (input.type === "bool") {
        // For booleans, convert string to actual boolean
        return value.toLowerCase() === "true" || value === "1"
      } else {
        // For other types (strings, bytes, etc.)
        return value
      }
    })

    // Send message to extension to execute the function
    vscode.postMessage({
      command: "executeContractFunction",
      functionName: selectedFunction.name,
      inputs: formattedInputs,
      currentState: currentState,
    })

    // Reset execution state after a delay (or ideally when we get a response)
    setTimeout(() => {
      setIsExecuting(false)
    }, 1000)
  }

  return (
    <div className="contract-simulator">
      <h2>Contract Simulator</h2>
      <p>Select a function and provide inputs to simulate contract execution</p>

      <div className="function-selector">
        <VSCodeDropdown onChange={handleFunctionSelect}>
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
                    onChange={(e: any) => handleInputChange(input.name, e.target.value)}
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
            <VSCodeButton onClick={executeFunction} disabled={isExecuting}>
              {isExecuting ? "Executing..." : "Execute Function"}
            </VSCodeButton>
          </div>

          <VSCodeDivider />

          <div className="function-info">
            <p>
              <strong>State Mutability:</strong> {selectedFunction.stateMutability}
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
  )
}

export default ContractSimulator
