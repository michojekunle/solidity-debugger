// FOUNDRY ADAPTER
import * as childProcess from 'child_process';
import * as net from 'net';
import { StateCollector } from '../stateProcessor/stateCollector';

export class FoundryDebugAdapter {
  private foundryProcess?: childProcess.ChildProcess;
  private debugSocket?: net.Socket;
  private stateCollector: StateCollector;

  constructor(private workspaceRoot: string, stateCollector: StateCollector) {
    this.stateCollector = stateCollector;
  }

  public async start(additionalArgs: string[] = []): Promise<number> {
    // Launch foundry anvil with debugging enabled
    const args = ['anvil', ...additionalArgs];
    
    this.foundryProcess = childProcess.spawn(
      args[0],
      args.slice(1),
      { cwd: this.workspaceRoot }
    );

    // Find the debug port from output
    return this.extractDebugPort();
  }

  private async extractDebugPort(): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      if (!this.foundryProcess) {
        return reject(new Error('Foundry process not started'));
      }
      
      // Default port for Anvil
      const defaultPort = 8545;
      let portFound = false;
      
      // Regular expression to extract port information from Anvil output
      // Anvil typically shows: "Listening on 127.0.0.1:8545"
      const portRegex = /Listening on (?:127\.0\.0\.1|localhost|0\.0\.0\.0):(\d+)/;
      
      // Set a timeout in case we don't see the expected output
      const timeout = setTimeout(() => {
        if (!portFound) {
          console.log('Did not find port in output, using default port:', defaultPort);
          portFound = true;
          resolve(defaultPort);
        }
      }, 5000); // 5 second timeout
      
      // Process stdout data
      this.foundryProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        console.log('Anvil output:', output);
        
        const match = output.match(portRegex);
        if (match && match[1]) {
          const port = parseInt(match[1], 10);
          console.log('Detected Anvil running on port:', port);
          portFound = true;
          clearTimeout(timeout);
          resolve(port);
        }
      });
      
      // Handle potential errors
      this.foundryProcess.stderr?.on('data', (data) => {
        console.error('Anvil error:', data.toString());
      });
      
      this.foundryProcess.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to start Anvil: ${err.message}`));
      });
      
      this.foundryProcess.on('exit', (code) => {
        if (!portFound) {
          clearTimeout(timeout);
          reject(new Error(`Anvil exited with code ${code} before port was found`));
        }
      });
    });
  }

  public async connect(port: number): Promise<void> {
    // Connect to the foundry debug port
    this.debugSocket = new net.Socket();
    await new Promise<void>((resolve, reject) => {
      this.debugSocket!.connect(port, 'localhost', () => {
        resolve();
      });
      
      this.debugSocket!.on('error', (err) => {
        reject(err);
      });
    });

    // Set up event listeners for state changes
    this.setupStateChangeListeners();
  }

  private setupStateChangeListeners() {
    if (!this.debugSocket) return;

    this.debugSocket.on('data', (data) => {
      try {
        // Parse the debug data
        const debugData = JSON.parse(data.toString());
        
        // Process state changes - updated to use the new StateCollector methods
        if (debugData.method === 'debug_traceTransaction') {
          // The new StateCollector processes trace data differently
          const traceData = {
            hash: debugData.params[0], // Transaction hash
            structLogs: debugData.result.structLogs || [],
            from: debugData.result.from,
            to: debugData.result.to,
            value: debugData.result.value
          };
          
          // Process the trace data with the StateCollector
          this.stateCollector.processTraceData(traceData);
        }
      } catch (error) {
        console.error('Error processing debug data:', error);
      }
    });
  }

  public async stop(): Promise<void> {
    // Clean up resources
    if (this.debugSocket) {
      this.debugSocket.destroy();
      this.debugSocket = undefined;
    }
    
    if (this.foundryProcess) {
      this.foundryProcess.kill();
      this.foundryProcess = undefined;
    }
  }
}