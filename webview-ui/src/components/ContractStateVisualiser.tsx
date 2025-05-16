import type React from "react"
import { VSCodeBadge } from "@vscode/webview-ui-toolkit/react"
import type { StateChange } from "../types"

interface ContractStateVisualizerProps {
  stateChanges: StateChange[]
}

const ContractStateVisualizer: React.FC<ContractStateVisualizerProps> = ({ stateChanges }) => {
  return (
    <div className="state-container">
      {stateChanges.length === 0 ? (
        <div className="state-change">No state changes detected.</div>
      ) : (
        stateChanges.map((change, index) => (
          <div className="state-change" key={index}>
            <div className="variable-name">
              {change.variableName || change.slot}
              {change.operation && <VSCodeBadge className="operation-badge">{change.operation}</VSCodeBadge>}
            </div>

            <div className="values">
              <div className="old-value" title="Previous value">
                {change.oldValue}
              </div>
              <div className="new-value" title="Current value">
                {change.newValue}
              </div>
            </div>

            {change.typeInfo && <div className="type-info">{change.typeInfo}</div>}
          </div>
        ))
      )}
    </div>
  )
}

export default ContractStateVisualizer
