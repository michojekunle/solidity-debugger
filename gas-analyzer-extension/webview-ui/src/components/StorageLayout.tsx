import type React from "react"
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
  return (
    <div className="storage-layout">
      <h3>Contract Storage Layout</h3>
      {variables.length === 0 ? (
        <p>No storage variables found. Analyze a contract to see its storage layout.</p>
      ) : (
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

          {variables.map((variable, index) => (
            <VSCodeDataGridRow key={index}>
              <VSCodeDataGridCell grid-column="1">{variable.slot}</VSCodeDataGridCell>
              <VSCodeDataGridCell grid-column="2">{variable.name}</VSCodeDataGridCell>
              <VSCodeDataGridCell grid-column="3">{variable.type}</VSCodeDataGridCell>
              <VSCodeDataGridCell grid-column="4">{variable.offset || 0}</VSCodeDataGridCell>
            </VSCodeDataGridRow>
          ))}
        </VSCodeDataGrid>
      )}
    </div>
  )
}

export default StorageLayout
