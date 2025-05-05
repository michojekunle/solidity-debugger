import * as childProcess from 'child_process';
import * as net from 'net';
import { StateCollector } from '../stateProcessor/stateCollector';

export class HardhatDebugAdapter {
  private hardhatProcess?: childProcess.ChildProcess;
  private debugSocket?: net.Socket;
  private stateCollector: StateCollector;

  constructor(private workspaceRoot: string, stateCollector: StateCollector) {
    this.stateCollector = stateCollector;
  }

  public async start(): Promise<number> {
    // Launch hardhat node with debugging enabled
    this.hardhatProcess = childProcess.spawn(
      'npx',
      ['hardhat', 'node', '--verbose'],
      { cwd: this.workspaceRoot }
    );

    // Find the debug port from output
    return this.extractDebugPort();
  }

  private async extractDebugPort(): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      // This is a simplified version - in real implementation,
      // you would parse the output of hardhat node to find the debug port
      resolve(8545); // Default port for hardhat node
    });
  }

  public async connect(port: number): Promise<void> {
    // Connect to the hardhat debug port
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
      // Parse the debug data
      const debugData = JSON.parse(data.toString());
      
      // Process state changes
      if (debugData.method === 'debug_traceTransaction') {
        this.stateCollector.processStateChanges(debugData.result);
      }
    });
  }

  public async stop(): Promise<void> {
    // Clean up resources
    if (this.debugSocket) {
      this.debugSocket.destroy();
      this.debugSocket = undefined;
    }
    
    if (this.hardhatProcess) {
      this.hardhatProcess.kill();
      this.hardhatProcess = undefined;
    }
  }
}