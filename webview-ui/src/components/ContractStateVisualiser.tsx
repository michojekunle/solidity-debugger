import type React from "react"
import { VSCodeBadge, VSCodeDivider } from "@vscode/webview-ui-toolkit/react"
import type { StateChange, ContractState } from "../types"

interface ContractStateVisualizerProps {
  stateChanges: StateChange[]
  contractState?: ContractState
}

const ContractStateVisualizer: React.FC<ContractStateVisualizerProps> = ({ stateChanges, contractState }) => {
  // Group state changes by variable name for better visualization
  const groupedChanges: Record<string, StateChange[]> = {}

  stateChanges.forEach((change) => {
    const key = change.variableName || change.slot
    if (!groupedChanges[key]) {
      groupedChanges[key] = []
    }
    groupedChanges[key].push(change)
  })

  return (
    <div className="state-container">
      {contractState && Object.keys(contractState).length > 0 && (
        <div className="current-state-section">
          <h3>Current Contract State</h3>
          <div className="current-state-grid">
            {Object.entries(contractState).map(([name, value]) => (
              <div className="state-variable" key={name}>
                <div className="variable-name">{name}</div>
                <div className="variable-value">{value.displayValue || value.value}</div>
                <div className="variable-type">{value.type}</div>
              </div>
            ))}
          </div>
          <VSCodeDivider />
        </div>
      )}

      <h3>State Changes</h3>
      {Object.keys(groupedChanges).length === 0 ? (
        <div className="state-change">No state changes detected.</div>
      ) : (
        Object.entries(groupedChanges).map(([variableName, changes]) => (
          <div className="variable-history" key={variableName}>
            <div className="variable-header">
              <h4>{variableName}</h4>
              <VSCodeBadge>{changes[0].typeInfo || "unknown"}</VSCodeBadge>
            </div>

            <div className="changes-timeline">
              {changes.map((change, index) => (
                <div className="state-change" key={index}>
                  <div className="change-header">
                    <VSCodeBadge className="operation-badge">{change.operation}</VSCodeBadge>
                    {change.transaction && (
                      <span className="transaction-hash">Tx: {change.transaction.substring(0, 10)}...</span>
                    )}
                  </div>

                  <div className="values">
                    <div className="old-value" title="Previous value">
                      {change.oldValue}
                    </div>
                    <div className="arrow">→</div>
                    <div className="new-value" title="Current value">
                      {change.newValue}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

export default ContractStateVisualizer
