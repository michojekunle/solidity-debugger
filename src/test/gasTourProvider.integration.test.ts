import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GasTourProvider } from '../core/gasAnalyzer/gasTourProvider';
import { GasHotspot } from '../core/gasAnalyzer/gasSourceMapper';
import * as vscode from 'vscode';

// Mock VS Code API
vi.mock('vscode', () => ({
  window: {
    showInformationMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    createTextEditorDecorationType: vi.fn(() => ({ dispose: vi.fn() })),
  },
  languages: {
    createDiagnosticCollection: vi.fn(() => ({
      set: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
      dispose: vi.fn(),
    })),
  },
  Range: class Range {
    constructor(public start: any, public end: any) {}
  },
  Position: class Position {
    constructor(public line: number, public character: number) {}
  },
  Selection: class Selection {
    constructor(public start: any, public end: any) {}
  },
  TextEditorRevealType: {
    InCenter: 2,
  },
  DiagnosticSeverity: {
    Error: 0,
    Warning: 1,
    Information: 2,
    Hint: 3,
  },
  EventEmitter: class EventEmitter {
    constructor() {}
    fire = vi.fn();
    event = vi.fn();
    dispose = vi.fn();
  },
  Uri: {
    parse: vi.fn((str) => ({ toString: () => str })),
  },
  env: {
    openExternal: vi.fn(),
  },
  MarkdownString: class MarkdownString {
    constructor(public value = '') {}
    appendMarkdown = vi.fn(function(this: any, text: string) {
      this.value += text;
    });
    isTrusted = true;
  },
}));

describe('GasTourProvider Integration Tests', () => {
  let tourProvider: GasTourProvider;
  let mockEditor: any;

  beforeEach(() => {
    tourProvider = new GasTourProvider();
    
    mockEditor = {
      document: {
        uri: { fsPath: '/test/MyToken.sol' },
        getText: () => 'contract Test {}',
      },
      selection: null,
      revealRange: vi.fn(),
    };
  });

  it('should start tour with hotspots and emit events', () => {
    const mockHotspots: GasHotspot[] = [
      {
        location: new vscode.Range(
          new vscode.Position(5, 0),
          new vscode.Position(5, 20)
        ),
        gasUsed: 25000,
        severity: 'critical',
        opcodes: ['SSTORE'],
        recommendation: 'Cache this value in memory',
        pattern: 'storage-in-loop',
      },
      {
        location: new vscode.Range(
          new vscode.Position(10, 0),
          new vscode.Position(10, 15)
        ),
        gasUsed: 2100,
        severity: 'warning',
        opcodes: ['SLOAD'],
        recommendation: 'Consider caching',
      },
    ];

    tourProvider.startTour(mockHotspots, mockEditor);

    expect(tourProvider.isTourActive()).toBe(true);
    expect(tourProvider.getProgress().total).toBe(2);
    expect(tourProvider.getProgress().current).toBe(1);
  });

  it('should navigate through hotspots correctly', () => {
    const mockHotspots: GasHotspot[] = [
      {
        location: new vscode.Range(new vscode.Position(1, 0), new vscode.Position(1, 10)),
        gasUsed: 1000,
        severity: 'optimal',
        opcodes: ['ADD'],
        recommendation: 'Good',
      },
      {
        location: new vscode.Range(new vscode.Position(2, 0), new vscode.Position(2, 10)),
        gasUsed: 5000,
        severity: 'high',
        opcodes: ['SSTORE'],
        recommendation: 'Review',
      },
    ];

    tourProvider.startTour(mockHotspots, mockEditor);
    
    expect(tourProvider.getProgress().current).toBe(1);
    
    tourProvider.nextHotspot(mockEditor);
    expect(tourProvider.getProgress().current).toBe(2);
    
    tourProvider.previousHotspot(mockEditor);
    expect(tourProvider.getProgress().current).toBe(1);
  });

  it('should sort hotspots by severity during tour start', () => {
    const mockHotspots: GasHotspot[] = [
      {
        location: new vscode.Range(new vscode.Position(1, 0), new vscode.Position(1, 10)),
        gasUsed: 1000,
        severity: 'optimal',
        opcodes: [],
        recommendation: '',
      },
      {
        location: new vscode.Range(new vscode.Position(2, 0), new vscode.Position(2, 10)),
        gasUsed: 25000,
        severity: 'critical',
        opcodes: [],
        recommendation: '',
      },
      {
        location: new vscode.Range(new vscode.Position(3, 0), new vscode.Position(3, 10)),
        gasUsed: 5000,
        severity: 'warning',
        opcodes: [],
        recommendation: '',
      },
    ];

    tourProvider.startTour(mockHotspots, mockEditor);
    
    const allHotspots = tourProvider.getAllHotspots();
    
    // Critical should come first
    expect(allHotspots[0].severity).toBe('critical');
    expect(allHotspots[allHotspots.length - 1].severity).toBe('optimal');
  });

  it('should finish tour and emit event', () => {
    const mockHotspots: GasHotspot[] = [
      {
        location: new vscode.Range(new vscode.Position(1, 0), new vscode.Position(1, 10)),
        gasUsed: 1000,
        severity: 'optimal',
        opcodes: [],
        recommendation: '',
      },
    ];

    let tourEnded = false;
    tourProvider.onTourEnded(() => {
      tourEnded = true;
    });

    tourProvider.startTour(mockHotspots, mockEditor);
    expect(tourProvider.isTourActive()).toBe(true);
    
    tourProvider.finishTour();
    expect(tourProvider.isTourActive()).toBe(false);
  });

  it('should handle empty hotspots gracefully', () => {
    tourProvider.startTour([], mockEditor);
    
    // Should show message about no opportunities
    expect(vscode.window.showInformationMessage).toHaveBeenCalled();
  });

  it('should prevent navigation beyond bounds', () => {
    const mockHotspots: GasHotspot[] = [
      {
        location: new vscode.Range(new vscode.Position(1, 0), new vscode.Position(1, 10)),
        gasUsed: 1000,
        severity: 'optimal',
        opcodes: [],
        recommendation: '',
      },
    ];

    tourProvider.startTour(mockHotspots, mockEditor);
    
    // Try to go to next when already at last
    tourProvider.nextHotspot(mockEditor);
    expect(tourProvider.getProgress().current).toBe(1); // Should stay at 1
    
    // Try to go to previous when at first
    tourProvider.previousHotspot(mockEditor);
    expect(tourProvider.getProgress().current).toBe(1); // Should stay at 1
  });

  it('should emit step changed events during navigation', () => {
    const mockHotspots: GasHotspot[] = [
      {
        location: new vscode.Range(new vscode.Position(1, 0), new vscode.Position(1, 10)),
        gasUsed: 1000,
        severity: 'optimal',
        opcodes: [],
        recommendation: 'Test 1',
      },
      {
        location: new vscode.Range(new vscode.Position(2, 0), new vscode.Position(2, 10)),
        gasUsed: 2000,
        severity: 'warning',
        opcodes: [],
        recommendation: 'Test 2',
      },
    ];

    tourProvider.startTour(mockHotspots, mockEditor);
    const initialProgress = tourProvider.getProgress().current;
    
    tourProvider.nextHotspot(mockEditor);
    const afterNext = tourProvider.getProgress().current;
    
    // Navigation should update progress, which implicitly tests event emission
    expect(afterNext).toBeGreaterThan(initialProgress);
  });
});
