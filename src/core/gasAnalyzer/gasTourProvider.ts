import * as vscode from "vscode";
import type { GasHotspot } from "./gasSourceMapper";

/**
 * Manages the guided tour through gas optimization opportunities
 */
export class GasTourProvider {
  private hotspots: GasHotspot[] = [];
  private currentIndex: number = -1;
  private isActive: boolean = false;
  private tourEndedEmitter = new vscode.EventEmitter<void>();
  private stepChangedEmitter = new vscode.EventEmitter<{ current: number; total: number; hotspot: GasHotspot }>();

  public readonly onTourEnded = this.tourEndedEmitter.event;
  public readonly onStepChanged = this.stepChangedEmitter.event;

  /**
   * Start a new gas optimization tour
   */
  public startTour(hotspots: GasHotspot[], editor: vscode.TextEditor): void {
    if (hotspots.length === 0) {
      vscode.window.showInformationMessage('No gas optimization opportunities found.');
      return;
    }

    // Sort by severity (critical first) then by gas usage
    this.hotspots = hotspots.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, warning: 2, optimal: 3 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      return severityDiff !== 0 ? severityDiff : b.gasUsed - a.gasUsed;
    });

    this.currentIndex = 0;
    this.isActive = true;

    vscode.window.showInformationMessage(
      `Gas Optimization Tour: Found ${this.hotspots.length} optimization opportunities. Use the navigation buttons or commands to navigate.`
    );

    this.navigateToCurrentHotspot(editor);
  }

  /**
   * Navigate to the next hotspot
   */
  public nextHotspot(editor: vscode.TextEditor): void {
    if (!this.isActive || this.hotspots.length === 0) {
      vscode.window.showWarningMessage('No active gas tour. Start a tour first.');
      return;
    }

    if (this.currentIndex < this.hotspots.length - 1) {
      this.currentIndex++;
      this.navigateToCurrentHotspot(editor);
    } else {
      vscode.window.showInformationMessage('You have reached the last optimization opportunity.');
    }
  }

  /**
   * Navigate to the previous hotspot
   */
  public previousHotspot(editor: vscode.TextEditor): void {
    if (!this.isActive || this.hotspots.length === 0) {
      vscode.window.showWarningMessage('No active gas tour. Start a tour first.');
      return;
    }

    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.navigateToCurrentHotspot(editor);
    } else {
      vscode.window.showInformationMessage('You are at the first optimization opportunity.');
    }
  }

  /**
   * Jump to a specific hotspot by index
   */
  public jumpToHotspot(index: number, editor: vscode.TextEditor): void {
    if (!this.isActive || index < 0 || index >= this.hotspots.length) {
      return;
    }

    this.currentIndex = index;
    this.navigateToCurrentHotspot(editor);
  }

  /**
   * Finish the tour
   */
  public finishTour(): void {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;
    this.currentIndex = -1;
    this.tourEndedEmitter.fire();

    vscode.window.showInformationMessage('Gas optimization tour completed. Diagnostic markers will remain in the editor.');
  }

  /**
   * Navigate to the current hotspot in the editor
   */
  private navigateToCurrentHotspot(editor: vscode.TextEditor): void {
    if (this.currentIndex < 0 || this.currentIndex >= this.hotspots.length) {
      return;
    }

    const hotspot = this.hotspots[this.currentIndex];
    
    // Reveal and center the hotspot in the editor
    editor.revealRange(hotspot.location, vscode.TextEditorRevealType.InCenter);
    editor.selection = new vscode.Selection(hotspot.location.start, hotspot.location.end);

    // Fire event for UI updates
    this.stepChangedEmitter.fire({
      current: this.currentIndex + 1,
      total: this.hotspots.length,
      hotspot
    });
  }

  /**
   * Get the current hotspot
   */
  public getCurrentHotspot(): GasHotspot | null {
    if (this.currentIndex < 0 || this.currentIndex >= this.hotspots.length) {
      return null;
    }
    return this.hotspots[this.currentIndex];
  }

  /**
   * Get all hotspots
   */
  public getAllHotspots(): GasHotspot[] {
    return [...this.hotspots];
  }

  /**
   * Check if tour is active
   */
  public isTourActive(): boolean {
    return this.isActive;
  }

  /**
   * Get current progress
   */
  public getProgress(): { current: number; total: number } {
    return {
      current: this.currentIndex + 1,
      total: this.hotspots.length
    };
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.tourEndedEmitter.dispose();
    this.stepChangedEmitter.dispose();
  }
}
