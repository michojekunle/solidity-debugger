// src/providers/codeActionProvider.ts
import * as vscode from 'vscode';

export class CodeActionProvider implements vscode.CodeActionProvider {
    provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range,
        context: vscode.CodeActionContext
    ): vscode.CodeAction[] {
        
        const actions: vscode.CodeAction[] = [];
        
        // Process each diagnostic in the range
        context.diagnostics
            .filter(diagnostic => diagnostic.source === 'Gas Optimizer')
            .forEach(diagnostic => {
                const action = this.createQuickFix(document, diagnostic);
                if (action) actions.push(action);
            });
        
        return actions;
    }

    private createQuickFix(
        document: vscode.TextDocument,
        diagnostic: vscode.Diagnostic
    ): vscode.CodeAction | undefined {
        
        const action = new vscode.CodeAction(
            `Fix: ${diagnostic.message}`,
            vscode.CodeActionKind.QuickFix
        );
        
        action.diagnostics = [diagnostic];
        action.isPreferred = true;
        
        // Generate the fix based on diagnostic code
        switch (diagnostic.code) {
            case 'redundantSLOAD':
                action.edit = this.fixRedundantSLOAD(document, diagnostic.range);
                break;
            case 'publicVsExternal':
                action.edit = this.fixPublicVsExternal(document, diagnostic.range);
                break;
            case 'storageInLoop':
                action.edit = this.fixStorageInLoop(document, diagnostic.range);
                break;
        }
        
        return action;
    }

    private fixRedundantSLOAD(document: vscode.TextDocument, range: vscode.Range): vscode.WorkspaceEdit {
        const edit = new vscode.WorkspaceEdit();
        
        // Extract the storage variable and cache it
        const text = document.getText(range);
        const storageVar = text.match(/(\w+)\[(\w+)\]/)?.[0];
        
        if (storageVar) {
            const cachedVar = `cached${storageVar.replace(/[^\w]/g, '')}`;
            const cacheDeclaration = `uint256 ${cachedVar} = ${storageVar};\n`;
            
            // Insert cache declaration at start of function
            const functionStart = this.findFunctionStart(document, range.start);
            edit.insert(document.uri, functionStart, cacheDeclaration);
            
            // Replace all occurrences with cached variable
            const functionRange = this.getFunctionRange(document, range.start);
            const functionText = document.getText(functionRange);
            const replacedText = functionText.replace(
                new RegExp(escapeRegExp(storageVar), 'g'),
                cachedVar
            );
            
            edit.replace(document.uri, functionRange, replacedText);
        }
        
        return edit;
    }
}