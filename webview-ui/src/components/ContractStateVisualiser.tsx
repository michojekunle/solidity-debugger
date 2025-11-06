"use client"

import type React from "react"
import { useMemo } from "react"
import { VSCodeBadge, VSCodeDivider } from "@vscode/webview-ui-toolkit/react"
import type { StateChange, ContractState } from "../types"

interface ContractStateVisualizerProps {
  stateChanges: StateChange[]
  contractState?: ContractState
}

const ContractStateVisualizer: React.FC<ContractStateVisualizerProps> = ({ stateChanges, contractState }) => {
  const groupedChanges = useMemo(() => {
    const grouped: Record<string, StateChange[]> = {}

    stateChanges.forEach((change) => {
      const key = change.variableName || change.slot
      if (!grouped[key]) {
        grouped[key] = []
      }
      grouped[key].push(change)
    })

    return grouped
  }, [stateChanges])

  const sortedVariables = useMemo(() => {
    return Object.keys(groupedChanges).sort()
  }, [groupedChanges])

  return (
    <div className="state-container">
      {contractState && Object.keys(contractState).length > 0 && (
        <div className="current-state-section">
          <div className="section-header">
            <h3>Current Contract State</h3>
            <span className="state-count">{Object.keys(contractState).length} variables</span>
          </div>
          <div className="current-state-grid">
            {Object.entries(contractState)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([name, value]) => (
                <div className="state-variable" key={name} title={`Slot: ${value.slot || "unknown"}`}>
                  <div className="variable-name">{name}</div>
                  <div className="variable-value">{value.displayValue || value.value}</div>
                  <div className="variable-type">{value.type}</div>
                </div>
              ))}
          </div>
          <VSCodeDivider />
        </div>
      )}

      <div className="section-header">
        <h3>State Changes</h3>
        <span className="change-count">{stateChanges.length} changes</span>
      </div>

      {sortedVariables.length === 0 ? (
        <div className="state-change empty-message">
          <p>No state changes detected. Execute a function to see changes.</p>
        </div>
      ) : (
        sortedVariables.map((variableName) => {
          const changes = groupedChanges[variableName] || []
          return (
            <div className="variable-history" key={variableName}>
              <div className="variable-header">
                <div className="header-info">
                  <h4>{variableName}</h4>
                  <VSCodeBadge className="type-badge">{changes[0].typeInfo || "unknown"}</VSCodeBadge>
                </div>
                <span className="change-count">{changes.length}</span>
              </div>

              <div className="changes-timeline">
                {changes.map((change, index) => (
                  <div className={`state-change operation-${change.operation.toLowerCase()}`} key={index}>
                    <div className="change-header">
                      <VSCodeBadge className={`operation-badge op-${change.operation.toLowerCase()}`}>
                        {change.operation}
                      </VSCodeBadge>
                      {change.transaction && (
                        <span className="transaction-hash" title={change.transaction}>
                          Tx: {change.transaction.substring(0, 10)}...
                        </span>
                      )}
                      <span className="change-index">#{index + 1}</span>
                    </div>

                    <div className="values">
                      <div className="value-pair">
                        <span className="label">From:</span>
                        <div className="old-value" title={`Previous value: ${change.oldValue}`}>
                          {change.oldValue}
                        </div>
                      </div>
                      <div className="arrow">→</div>
                      <div className="value-pair">
                        <span className="label">To:</span>
                        <div className="new-value" title={`Current value: ${change.newValue}`}>
                          {change.newValue}
                        </div>
                      </div>
                    </div>

                    <div className="change-meta">
                      <span className="pc">PC: {change.pc}</span>
                      <span className="depth">Depth: {change.depth}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

export default ContractStateVisualizer
