// src/integrations/hardhatIntegration.ts
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export class HardhatIntegration {
    private projectRoot: string;
    private configPath: string;

    constructor(workspaceRoot: string) {
        this.projectRoot = workspaceRoot;
        this.configPath = path.join(workspaceRoot, 'hardhat.config.js');
    }

    async isHardhatProject(): Promise<boolean> {
        return fs.existsSync(this.configPath) || 
               fs.existsSync(path.join(this.projectRoot, 'hardhat.config.ts'));
    }

    async compileWithGasReporting(contractPath: string): Promise<CompilationResult> {
        return new Promise((resolve, reject) => {
            const child = spawn('npx', ['hardhat', 'compile', '--show-stack-traces'], {
                cwd: this.projectRoot,
                stdio: 'pipe'
            });

            let output = '';
            child.stdout.on('data', (data) => {
                output += data.toString();
            });

            child.on('close', (code) => {
                if (code === 0) {
                    const artifacts = this.parseArtifacts(output);
                    resolve({
                        success: true,
                        artifacts,
                        gasEstimates: this.extractGasEstimates(artifacts)
                    });
                } else {
                    reject(new Error(`Compilation failed with code ${code}`));
                }
            });
        });
    }

    async runGasReporter(): Promise<GasReport> {
        // Execute hardhat gas reporter
        const child = spawn('npx', ['hardhat', 'test', '--gas-reporter'], {
            cwd: this.projectRoot,
            stdio: 'pipe'
        });

        return new Promise((resolve) => {
            let output = '';
            child.stdout.on('data', (data) => {
                output += data.toString();
            });

            child.on('close', () => {
                const gasReport = this.parseGasReport(output);
                resolve(gasReport);
            });
        });
    }

    private parseGasReport(output: string): GasReport {
        // Parse gas reporter output
        const lines = output.split('\n');
        const methods: MethodGasUsage[] = [];
        
        lines.forEach(line => {
            const match = line.match(/│\s+(\w+)\s+│\s+(\d+)\s+│\s+(\d+)\s+│\s+(\d+)\s+│/);
            if (match) {
                methods.push({
                    name: match[1],
                    min: parseInt(match[2]),
                    max: parseInt(match[3]),
                    avg: parseInt(match[4])
                });
            }
        });

        return { methods };
    }
}