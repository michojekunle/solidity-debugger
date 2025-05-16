export interface StateChange {
  slot: string
  oldValue: string
  newValue: string
  variableName?: string
  typeInfo?: string
  operation?: string
  pc?: number
  depth?: number
  transaction?: string
}

export interface StateSnapshot {
  id: number
  timestamp: number
  changes: StateChange[]
  hash?: string
  contextInfo?: any
}
