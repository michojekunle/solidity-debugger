export interface StateChange {
  slot: string
  oldValue: string
  newValue: string
  variableName?: string
  typeInfo?: string
  operation: string
  pc: number
  depth: number
  transaction?: string
}

export interface StateSnapshot {
  id: number
  timestamp: number
  changes: StateChange[]
  hash?: string
  contextInfo?: any
}

export interface ContractFunction {
  name: string
  inputs: {
    name: string
    type: string
  }[]
  outputs: {
    name: string
    type: string
  }[]
  stateMutability: "pure" | "view" | "nonpayable" | "payable"
}

export interface ContractState {
  [key: string]: {
    type: string
    value: string
    displayValue: string
    previousValue?: string
    lastChanged?: number
    slot?: string
    operation?: string
  }
}

export interface StorageVariable {
  slot: string
  name: string
  type: string
  offset?: number
}

export interface ContractInfo {
  name: string
  abi: ContractFunction[]
  storageLayout: StorageVariable[]
  bytecode?: string
}
