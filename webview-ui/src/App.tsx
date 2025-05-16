"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { vscode } from "./vscode";
import {
  VSCodeButton,
  VSCodePanels,
  VSCodePanelTab,
  VSCodePanelView,
  VSCodeProgressRing,
} from "@vscode/webview-ui-toolkit/react";
import ContractStateVisualizer from "./components/ContractStateVisualiser";
import type { StateChange } from "./types";

const App: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [stateChanges, setStateChanges] = useState<StateChange[]>([]);
  const [, setActiveTab] = useState<string>("state");

  useEffect(() => {
    // Set up message listener
    window.addEventListener("message", handleMessage);

    // Request initial state changes when component mounts
    vscode.postMessage({
      command: "getStateChanges",
    });

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  const handleMessage = (event: MessageEvent) => {
    const message = event.data;

    switch (message.command) {
      case "updateStateChanges":
        setStateChanges(message.stateChanges || []);
        setLoading(false);
        break;

      case "contractAnalyzed":
        // Handle when a new contract is analyzed
        setLoading(false);
        setStateChanges(message.stateChanges || []);
        break;
    }
  };

  const requestAnalysis = () => {
    setLoading(true);
    vscode.postMessage({
      command: "analyzeContract",
    });
  };

  return (
    <div className="container">
      <header>
        <h1>Solidity State Visualizer</h1>
        <VSCodeButton onClick={requestAnalysis}>
          Analyze Current Contract
        </VSCodeButton>
      </header>

      <VSCodePanels>
        <VSCodePanelTab id="state" onClick={() => setActiveTab("state")}>
          State Changes
        </VSCodePanelTab>
        <VSCodePanelTab
          id="variables"
          onClick={() => setActiveTab("variables")}
        >
          Variables
        </VSCodePanelTab>
        <VSCodePanelTab id="storage" onClick={() => setActiveTab("storage")}>
          Storage Layout
        </VSCodePanelTab>

        <VSCodePanelView id="state-view">
          {loading ? (
            <div className="loading-container">
              <VSCodeProgressRing />
              <p>Loading contract state...</p>
            </div>
          ) : stateChanges.length > 0 ? (
            <ContractStateVisualizer stateChanges={stateChanges} />
          ) : (
            <div className="empty-state">
              <p>
                No state changes detected. Analyze a contract to visualize its
                state.
              </p>
              <VSCodeButton onClick={requestAnalysis}>
                Analyze Contract
              </VSCodeButton>
            </div>
          )}
        </VSCodePanelView>
      </VSCodePanels>
    </div>
  );
};

export default App;
