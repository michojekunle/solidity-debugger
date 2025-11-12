"use client"

import type React from "react"
import { useMemo } from "react"
import { VSCodeDataGrid, VSCodeDataGridCell, VSCodeDataGridRow } from "@vscode/webview-ui-toolkit/react"

interface StorageVariable {
  slot: string
  name: string
  type: string
  offset?: number
}

interface StorageLayoutProps {
  variables: StorageVariable[]
}

const StorageLayout: React.FC<StorageLayoutProps> = ({ variables }) => {
  const sortedVariables = useMemo(() => {
    return [...variables].sort((a, b) => {
      const aSlot = Number.parseInt(a.slot, 16)
      const bSlot = Number.parseInt(b.slot, 16)
      return aSlot - bSlot
    })
  }, [variables])

  return (
    <div className="storage-layout">
      <div className="storage-header">
        <h3>Contract Storage Layout</h3>
        {variables.length > 0 && <span className="variable-count">{variables.length} variables</span>}
      </div>

      {variables.length === 0 ? (
        <div className="empty-message">
          <p>No storage variables found. Analyze a contract to see its storage layout.</p>
        </div>
      ) : (
        <div className="storage-table-wrapper">
          <VSCodeDataGrid aria-label="Storage Layout">
            <VSCodeDataGridRow row-type="header">
              <VSCodeDataGridCell cell-type="columnheader" grid-column="1">
                Slot
              </VSCodeDataGridCell>
              <VSCodeDataGridCell cell-type="columnheader" grid-column="2">
                Variable
              </VSCodeDataGridCell>
              <VSCodeDataGridCell cell-type="columnheader" grid-column="3">
                Type
              </VSCodeDataGridCell>
              <VSCodeDataGridCell cell-type="columnheader" grid-column="4">
                Offset
              </VSCodeDataGridCell>
            </VSCodeDataGridRow>

            {sortedVariables.map((variable, index) => (
              <VSCodeDataGridRow key={index}>
                <VSCodeDataGridCell grid-column="1">
                  <span className="slot-badge">{variable.slot}</span>
                </VSCodeDataGridCell>
                <VSCodeDataGridCell grid-column="2">{variable.name}</VSCodeDataGridCell>
                <VSCodeDataGridCell grid-column="3">
                  <span className="type-label">{variable.type}</span>
                </VSCodeDataGridCell>
                <VSCodeDataGridCell grid-column="4">{variable.offset || 0}</VSCodeDataGridCell>
              </VSCodeDataGridRow>
            ))}
          </VSCodeDataGrid>
        </div>
      )}
    </div>
  )
}

export default StorageLayout
