import * as childProcess from 'child_process';
import * as net from 'net';
import { StateCollector } from '../stateProcessor/stateCollector';

export class FoundryDebugAdapter {
  private anvilProcess?: childProcess.ChildProcess;
  private stateCollector: StateCollector;

  constructor(private workspaceRoot: string, stateCollector: StateCollector) {
    this.stateCollector = stateCollector;
  }

  public async start(additionalArgs: string[] = []): Promise<number> {
    // Launch anvil node
    const baseCmd = 'anvil'; // Assuming anvil is in PATH
    
    // Default args if none provided
    const args = additionalArgs.length > 0 ? additionalArgs : ['--port', '8545'];
    
    console.log(`Starting Anvil in ${this.workspaceRoot} with args:`, args);
    
    this.anvilProcess = childProcess.spawn(
      baseCmd,
      args,
      { cwd: this.workspaceRoot }
    );

    // Find the debug port from output
    return this.extractDebugPort();
  }

  private async extractDebugPort(): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      if (!this.anvilProcess) {
        return reject(new Error('Anvil process not started'));
      }
      
      const defaultPort = 8545;
      let portFound = false;
      
      // Anvil output: "Listening on 127.0.0.1:8545"
    const portRegex = /Listening on .*:(\d+)/;
      
      const timeout = setTimeout(() => {
        if (!portFound) {
          console.log('Did not find port in output, using default port:', defaultPort);
          portFound = true;
          resolve(defaultPort);
        }
      }, 5000); 
      
      this.anvilProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        // console.log('Anvil:', output);
        
        const match = output.match(portRegex);
        if (match && match[1]) {
          const port = parseInt(match[1], 10);
          console.log('Detected Anvil running on port:', port);
          portFound = true;
          clearTimeout(timeout);
          resolve(port);
        }
      });
      
      this.anvilProcess.stderr?.on('data', (data) => {
        console.error('Anvil error:', data.toString());
      });
      
      this.anvilProcess.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to start Anvil: ${err.message}`));
      });
      
      this.anvilProcess.on('exit', (code) => {
        if (!portFound) {
          clearTimeout(timeout);
          reject(new Error(`Anvil exited with code ${code} before port was found`));
        }
      });
    });
  }
  
  // No longer used for direct connection, but kept for compatibility or advanced monitoring
  public async connect(_port: number): Promise<void> {
      // With the new architecture, we don't need to connect via raw socket
      // The StateCollector will connect via ethers JsonRpcProvider
      return;
  }

  public async stop(): Promise<void> {
    if (this.anvilProcess) {
      this.anvilProcess.kill();
      this.anvilProcess = undefined;
    }
  }
}