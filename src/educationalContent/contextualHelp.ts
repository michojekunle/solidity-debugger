import * as vscode from 'vscode';

interface HelpContent {
    key: string;
    title: string;
    content: string;
    relatedLinks: { title: string; url: string }[];
  }
  
  export class EducationalContentService {
    private helpContent: Map<string, HelpContent> = new Map();
    
    constructor() {
      this.initializeHelpContent();
    }
    
    private initializeHelpContent() {
      // Add help content for common Solidity patterns and issues
      this.addHelpContent({
        key: 'storage-optimization',
        title: 'Storage Optimization',
        content: 
          'Ethereum storage is expensive. Each storage slot costs 20,000 gas to initialize ' +
          'and 5,000 gas to update. You can optimize by packing multiple variables into a ' +
          'single storage slot, using smaller types, and using memory for temporary values.',
        relatedLinks: [
          { title: 'Solidity Storage Layout', url: 'https://docs.soliditylang.org/en/latest/internals/layout_in_storage.html' },
          { title: 'Gas Optimization Techniques', url: 'https://ethereum.org/en/developers/tutorials/gas-optimization-techniques/' }
        ]
      });
      
      this.addHelpContent({
        key: 'reentrancy',
        title: 'Reentrancy Protection',
        content: 
          'Reentrancy occurs when external calls are allowed to make new calls back into the ' +
          'calling contract before the first call is finished. Always follow the ' +
          'Checks-Effects-Interactions pattern and consider using reentrancy guards.',
        relatedLinks: [
          { title: 'Reentrancy Attack', url: 'https://consensys.github.io/smart-contract-best-practices/attacks/reentrancy/' },
          { title: 'Checks-Effects-Interactions Pattern', url: 'https://docs.soliditylang.org/en/latest/security-considerations.html#use-the-checks-effects-interactions-pattern' }
        ]
      });
      
      // Add more help content as needed
    }
    
    private addHelpContent(content: HelpContent) {
      this.helpContent.set(content.key, content);
    }
    
    public getHelpContent(key: string): HelpContent | undefined {
      return this.helpContent.get(key);
    }
    
    public getContextualHelp(sourceCode: string, position: vscode.Position): HelpContent | undefined {
      // Analyze the source code and position to determine the appropriate help content
      // This is a simplified implementation
      console.log(`Analyzing code at position: ${position.line}:${position.character}`);
      // For example, if the code at the position has storage operations, return storage optimization help
      if (sourceCode.includes('storage')) {
        return this.getHelpContent('storage-optimization');
      }
      
      // If the code has external calls, return reentrancy protection help
      if (sourceCode.includes('call') || sourceCode.includes('transfer')) {
        return this.getHelpContent('reentrancy');
      }
      
      return undefined;
    }
    
    dispose() {
      // Clean up resources
    }
  }
  