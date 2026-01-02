import * as vscode from "vscode";

export interface Insight {
  type: "security" | "optimization" | "codestyle";
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
}

/**
 * Service to generate smart insights using rule-based heuristics and (simulated) AI
 */
export class SmartInsightsService {
  
  public generateInsights(code: string, gasStats?: any): Insight[] {
      const insights: Insight[] = [];
      
      // 1. Static Security Analysis (Rule-based)
      if (this.detectReentancy(code)) {
          insights.push({
              type: "security",
              title: "Potential Reentrancy",
              description: "External call detected before state effects. Follow Checks-Effects-Interactions pattern.",
              impact: "high"
          });
      }
      
      if (this.detectUncheckedLowLevelCall(code)) {
          insights.push({
              type: "security",
              title: "Unchecked Low-level Call",
              description: "Result of call/delegatecall is not checked.",
              impact: "medium"
          });
      }

      // 2. Gas Optimization Insights (Data-driven)
      if (gasStats && gasStats.sloadCount > 5) {
           insights.push({
               type: "optimization",
               title: "Expensive Storage Reads",
               description: "Consider caching storage variables in memory (SLOAD count: " + gasStats.sloadCount + ")",
               impact: "medium"
           });
      }
      
      // 3. AI-Simulated Code Style (Placeholder for LLM)
      if (code.includes("uint ")) {
          insights.push({
              type: "codestyle",
              title: "Explicit Types",
              description: "Prefer 'uint256' over 'uint' for clarity.",
              impact: "low"
          });
      }

      return insights;
  }

  private detectReentancy(code: string): boolean {
      // Very naive regex check for demo purposes
      // Looks for .call{value: ...} followed eventually by storage assignment
      // patterns: call -> (lines) -> =
      return /call\{.*value/.test(code) && /storage.*=/.test(code); 
  }

  private detectUncheckedLowLevelCall(code: string): boolean {
      const lowLevelCalls = [".call", ".delegatecall", ".staticcall"];
      return lowLevelCalls.some(call => code.includes(call) && !code.includes("require") && !code.includes("if"));
  }
}
