import * as vscode from 'vscode';
import * as ethers from 'ethers';
import * as solc from 'solc';
// import * as fs from 'fs';
import * as path from 'path';

/**
 * Represents a change in the smart contract state
 */
export interface StateChange {
    slot: string;              // Storage slot that changed
    oldValue: string;          // Previous value (hex string)
    newValue: string;          // New value (hex string)
    variableName?: string;     // If available, the variable name associated with this slot
    typeInfo?: string;         // Type information for the value (uint256, address, etc.)
    operation: string;         // Operation that caused this change (SSTORE, etc.)
    pc: number;                // Program counter at time of change
    depth: number;             // Call depth
    transaction?: string;      // Transaction hash if available
}

/**
 * Represents a snapshot of state changes in a specific transaction/call
 */
export interface StateSnapshot {
    id: number;                // Sequential ID of this snapshot
    timestamp: number;         // When this snapshot was created
    changes: StateChange[];    // State changes in this snapshot
    hash?: string;             // Transaction hash if available
    contextInfo?: any;         // Additional context about this snapshot
}

/**
 * Maps ABI types to more user-friendly type descriptions
 */
const TYPE_MAPPING: Record<string, string> = {
    'uint256': 'Number (uint256)',
    'uint128': 'Number (uint128)',
    'uint64': 'Number (uint64)',
    'uint32': 'Number (uint32)',
    'uint16': 'Number (uint16)',
    'uint8': 'Number (uint8)',
    'int256': 'Signed Number (int256)',
    'int128': 'Signed Number (int128)',
    'int64': 'Signed Number (int64)',
    'int32': 'Signed Number (int32)',
    'int16': 'Signed Number (int16)',
    'int8': 'Signed Number (int8)',
    'address': 'Ethereum Address',
    'bool': 'Boolean',
    'string': 'Text String',
    'bytes': 'Byte Array',
    'bytes32': 'Fixed Bytes (32)',
};

/**
 * Service for collecting and analyzing smart contract state changes
 */
export class StateCollector implements vscode.Disposable {
    private snapshots: StateSnapshot[] = [];
    private slotToVariableMap: Map<string, { name: string, type: string }> = new Map();
    private currentContractAbi: any[] = [];
    private storageLayout: any = null;
    private provider: ethers.providers.JsonRpcProvider | null = null;
    
    // Event emitters
    private snapshotCreatedEmitter = new vscode.EventEmitter<StateSnapshot>();
    
    public readonly onSnapshotCreated = this.snapshotCreatedEmitter.event;

    constructor(private context: vscode.ExtensionContext) {
        // Try to connect to a local Ethereum node
        this.initializeProvider();
        
        // Set up Solidity compilation environment
        this.setupCompilationEnvironment();
    }

    /**
     * Initialize Ethereum provider for interacting with the blockchain
     */
    private initializeProvider() {
        try {
            // Try common development endpoints
            const endpoints = [
                'http://localhost:8545', // Ganache, Hardhat
                'http://localhost:7545', // Ganache UI default
                'http://127.0.0.1:8545', // Alternative localhost
            ];
            
            for (const endpoint of endpoints) {
                try {
                    const provider = new ethers.providers.JsonRpcProvider(endpoint);
                    // Test the connection
                    provider.getBlockNumber().then(() => {
                        this.provider = provider;
                        console.log(`Connected to Ethereum node at ${endpoint}`);
                    }).catch(() => {
                        // Connection failed, try next endpoint
                    });
                    
                    if (this.provider) break;
                } catch (error) {
                    // Try next endpoint
                }
            }
            
            if (!this.provider) {
                console.log('Could not connect to any local Ethereum node');
            }
        } catch (error) {
            console.error('Error initializing Ethereum provider:', error);
        }
    }

    /**
     * Set up the Solidity compilation environment
     */
    private setupCompilationEnvironment() {
        // This method would normally set up the proper solc-js environment
        // For VSCode extensions, you might need to bundle solc or use solc installed by the user
        console.log('Solidity compilation environment initialized');
    }

    /**
     * Clear all collected state
     */
    public clearState() {
        this.snapshots = [];
        this.slotToVariableMap.clear();
    }

    /**
     * Process trace data from a transaction and extract state changes
     */
    public processTraceData(traceData: any): StateSnapshot {
        // Create a new snapshot for this transaction
        const snapshotId = this.snapshots.length;
        const snapshot: StateSnapshot = {
            id: snapshotId,
            timestamp: Date.now(),
            changes: [],
            hash: traceData.hash,
            contextInfo: {
                to: traceData.to,
                from: traceData.from || 'unknown',
                value: traceData.value || '0x0'
            }
        };
        
        // Track the slot values for this transaction
        const slotValues: Map<string, string> = new Map();
        
        // Process each log entry in the trace
        for (const log of traceData.structLogs) {
            // We're mainly interested in SSTORE operations which change state
            if (log.op === 'SSTORE') {
                const slot = log.stack[log.stack.length - 2];  // Second to last item on stack is the slot
                const value = log.stack[log.stack.length - 1]; // Last item on stack is the value
                
                // Get the previous value for this slot
                const oldValue = slotValues.get(slot) || '0x0';
                
                // Only record if the value changed
                if (oldValue !== value) {
                    const change: StateChange = {
                        slot,
                        oldValue,
                        newValue: value,
                        operation: log.op,
                        pc: log.pc,
                        depth: log.depth
                    };
                    
                    // If we have mapping information for this slot, add it
                    const varInfo = this.slotToVariableMap.get(slot);
                    if (varInfo) {
                        change.variableName = varInfo.name;
                        change.typeInfo = varInfo.type;
                    } else {
                        // Try to infer the type based on the value
                        change.typeInfo = this.inferType(value);
                    }
                    
                    // Add the change to the snapshot
                    snapshot.changes.push(change);
                    
                    // Update our tracking of the current value
                    slotValues.set(slot, value);
                }
            }
        }
        
        // Add the snapshot to our collection
        this.snapshots.push(snapshot);
        
        // Notify listeners about the new snapshot
        this.snapshotCreatedEmitter.fire(snapshot);
        
        return snapshot;
    }
    
    /**
     * Process an active editor to analyze storage layout of contract
     */
    public async analyzeActiveContract() {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'solidity') {
            vscode.window.showWarningMessage('No Solidity file is currently active');
            return false;
        }
        
        try {
            // Get the file content
            const content = editor.document.getText();
            const filePath = editor.document.uri.fsPath;
            
            // Compile the contract to get storage layout
            const compilationResult = await this.compileSolidityContract(content, filePath);
            if (!compilationResult) {
                vscode.window.showErrorMessage('Failed to compile contract');
                return false;
            }
            
            // Process the compilation output
            this.processCompilationOutput(compilationResult);
            return true;
        } catch (error) {
            console.error('Error analyzing contract:', error);
            vscode.window.showErrorMessage(`Error analyzing contract: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }

    /**
     * Compile a Solidity contract and return the result
     */
    private async compileSolidityContract(source: string, filePath: string): Promise<any> {
        return new Promise((resolve, reject) => {
            try {
                // Prepare input for solc
                const fileName = path.basename(filePath);
                const input = {
                    language: 'Solidity',
                    sources: {
                        [fileName]: {
                            content: source
                        }
                    },
                    settings: {
                        outputSelection: {
                            '*': {
                                '*': ['abi', 'evm.bytecode', 'storageLayout']
                            }
                        }
                    }
                };
                
                // Compile
                const output = JSON.parse(solc.compile(JSON.stringify(input)));
                
                // Check for errors
                if (output.errors) {
                    const hasError = output.errors.some((error: any) => error.severity === 'error');
                    if (hasError) {
                        reject(new Error('Compilation failed: ' + JSON.stringify(output.errors)));
                        return;
                    }
                }
                
                resolve(output);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Process the output from the Solidity compiler
     */
    private processCompilationOutput(output: any) {
        // Find the compiled contract
        const fileName = Object.keys(output.contracts)[0];
        const contractName = Object.keys(output.contracts[fileName])[0];
        const contract = output.contracts[fileName][contractName];
        
        // Save ABI for later use
        this.currentContractAbi = contract.abi;
        
        // Process the storage layout
        this.storageLayout = contract.storageLayout;
        
        // Map storage slots to variable names
        if (this.storageLayout && this.storageLayout.storage) {
            this.slotToVariableMap.clear();
            
            for (const item of this.storageLayout.storage) {
                const slot = '0x' + parseInt(item.slot).toString(16);
                this.slotToVariableMap.set(slot, {
                    name: item.label,
                    type: this.mapTypeToFriendlyName(item.type)
                });
            }
        }
    }

    /**
     * Map a Solidity type to a more user-friendly description
     */
    private mapTypeToFriendlyName(solidityType: string): string {
        return TYPE_MAPPING[solidityType] || solidityType;
    }

    /**
     * Attempt to infer the type of a value based on its format
     */
    private inferType(value: string): string {
        // Remove 0x prefix if present
        const cleanValue = value.startsWith('0x') ? value.slice(2) : value;
        
        // Check if it's a small number (likely a bool or small uint)
        if (cleanValue === '0' || cleanValue === '1') {
            return 'Boolean or Number';
        }
        
        // Check if it looks like an address (20 bytes)
        if (cleanValue.length === 40) {
            return 'Likely Address';
        }
        
        // Check if it's a small number
        if (cleanValue.length <= 4) {
            return 'Small Number';
        }
        
        // Default assumption for larger values
        return 'Number or Bytes';
    }

    /**
     * Get the current available contract state snapshots
     */
    public getSnapshots(): StateSnapshot[] {
        return [...this.snapshots];
    }

    /**
     * Fetch and analyze the runtime state of a deployed contract
     */
    public async analyzeDeployedContract(contractAddress: string) {
        if (!this.provider) {
            vscode.window.showErrorMessage('No Ethereum provider available');
            return false;
        }
        
        try {
            // Check if the address exists
            const code = await this.provider.getCode(contractAddress);
            if (code === '0x') {
                vscode.window.showErrorMessage('No contract deployed at this address');
                return false;
            }
            
            // Create a new snapshot for this analysis
            const snapshotId = this.snapshots.length;
            const snapshot: StateSnapshot = {
                id: snapshotId,
                timestamp: Date.now(),
                changes: [],
                contextInfo: {
                    type: 'static_analysis',
                    address: contractAddress
                }
            };
            
            // Get storage values for the first few slots
            for (let i = 0; i < 10; i++) {
                const slot = '0x' + i.toString(16);
                const value = await this.provider.getStorageAt(contractAddress, slot);
                
                // Only include non-zero values
                if (value !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
                    const change: StateChange = {
                        slot,
                        oldValue: '0x0', // We don't know the previous value
                        newValue: value,
                        operation: 'ANALYSIS',
                        pc: 0,
                        depth: 0
                    };
                    
                    // If we have mapping information for this slot, add it
                    const varInfo = this.slotToVariableMap.get(slot);
                    if (varInfo) {
                        change.variableName = varInfo.name;
                        change.typeInfo = varInfo.type;
                    } else {
                        // Try to infer the type based on the value
                        change.typeInfo = this.inferType(value);
                    }
                    
                    snapshot.changes.push(change);
                }
            }
            
            // Only add the snapshot if we found any state
            if (snapshot.changes.length > 0) {
                this.snapshots.push(snapshot);
                this.snapshotCreatedEmitter.fire(snapshot);
                return true;
            } else {
                vscode.window.showInformationMessage('No state found in the first 10 storage slots');
                return false;
            }
        } catch (error) {
            console.error('Error analyzing deployed contract:', error);
            vscode.window.showErrorMessage(`Error analyzing deployed contract: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }

    /**
     * Analyze a transaction by fetching its trace
     */
    public async analyzeTransaction(txHash: string) {
        if (!this.provider) {
            vscode.window.showErrorMessage('No Ethereum provider available');
            return false;
        }
        
        try {
            // First check if the transaction exists
            const tx = await this.provider.getTransaction(txHash);
            if (!tx) {
                vscode.window.showErrorMessage('Transaction not found');
                return false;
            }
            
            // Request debug_traceTransaction from the provider
            // Note: This requires the node to support this method
            const trace = await this.provider.send('debug_traceTransaction', [
                txHash, 
                { tracer: 'callTracer' }
            ]);
            
            if (!trace) {
                vscode.window.showErrorMessage('Could not retrieve transaction trace. Ensure your node supports debug_traceTransaction');
                return false;
            }
            
            // Process the trace data
            const traceData = {
                hash: txHash,
                from: tx.from,
                to: tx.to,
                value: tx.value.toHexString(),
                structLogs: this.convertTraceFormat(trace)
            };
            
            this.processTraceData(traceData);
            return true;
        } catch (error) {
            console.error('Error analyzing transaction:', error);
            vscode.window.showErrorMessage(`Error analyzing transaction: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }

    /**
     * Convert trace format from debug_traceTransaction to the format we use
     */
    private convertTraceFormat(trace: any): any[] {
        // This is a simplified conversion - actual implementation would depend on
        // the exact format returned by your specific Ethereum node
        const structLogs: any[] = [];
        
        // Process the call tracer result
        if (trace.calls) {
            this.processTraceCall(trace, structLogs);
        }
        
        return structLogs;
    }

    /**
     * Process a call from the trace recursively
     */
    private processTraceCall(call: any, structLogs: any[], depth = 1) {
        // Process each opcode in the trace
        if (call.ops) {
            for (const op of call.ops) {
                // Convert to our format
                if (op.op === 'SSTORE') {
                    structLogs.push({
                        pc: op.pc || 0,
                        op: op.op,
                        stack: op.stack || [],
                        depth: depth,
                        gas: op.gas || 0
                    });
                }
            }
        }
        
        // Process nested calls
        if (call.calls && Array.isArray(call.calls)) {
            for (const subcall of call.calls) {
                this.processTraceCall(subcall, structLogs, depth + 1);
            }
        }
    }

    /**
     * Analyze memory dumps from debugging sessions
     */
    public analyzeMemoryDump(memoryData: any) {
        try {
            // Create a new snapshot for this memory dump
            const snapshotId = this.snapshots.length;
            const snapshot: StateSnapshot = {
                id: snapshotId,
                timestamp: Date.now(),
                changes: [],
                contextInfo: {
                    type: 'memory_dump'
                }
            };
            
            // Process the memory data
            for (const [slot, value] of Object.entries(memoryData)) {
                const change: StateChange = {
                    slot,
                    oldValue: '0x0', // We don't know the previous value
                    newValue: value as string,
                    operation: 'MEMORY_DUMP',
                    pc: 0,
                    depth: 0
                };
                
                // If we have mapping information for this slot, add it
                const varInfo = this.slotToVariableMap.get(slot);
                if (varInfo) {
                    change.variableName = varInfo.name;
                    change.typeInfo = varInfo.type;
                } else {
                    // Try to infer the type based on the value
                    change.typeInfo = this.inferType(value as string);
                }
                
                snapshot.changes.push(change);
            }
            
            // Add the snapshot to our collection
            this.snapshots.push(snapshot);
            
            // Notify listeners about the new snapshot
            this.snapshotCreatedEmitter.fire(snapshot);
            
            return snapshot;
        } catch (error) {
            console.error('Error analyzing memory dump:', error);
            vscode.window.showErrorMessage(`Error analyzing memory dump: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }

    /**
     * Collect real-time state from a debug session
     */
    public collectDebugState(debugSession: vscode.DebugSession) {
        // This would integrate with the VSCode debug API
        // This is a placeholder for actual implementation
        console.log('Debug session state collection started', debugSession);
        
        // In a full implementation, we would:
        // 1. Register for debug events
        // 2. Intercept breakpoint hits
        // 3. Evaluate expressions to get storage values
        // 4. Create snapshots based on those values
    }

    /**
     * Clean up resources when the extension is deactivated
     */
    public dispose() {
        this.snapshotCreatedEmitter.dispose();
    }
}