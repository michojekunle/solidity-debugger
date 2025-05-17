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
import ContractSimulator from "./components/ContractSimulator";
import StorageLayout from "./components/StorageLayout";
import type {
  StateChange,
  ContractFunction,
  ContractState,
  StorageVariable,
} from "./types";

const App: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [stateChanges, setStateChanges] = useState<StateChange[]>([]);
  const [contractFunctions, setContractFunctions] = useState<
    ContractFunction[]
  >([]);
  const [contractState, setContractState] = useState<ContractState>({});
  const [storageVariables, setStorageVariables] = useState<StorageVariable[]>(
    []
  );
  const [activeTab, setActiveTab] = useState<string>("state");
  const [contractName, setContractName] = useState<string>("");

  useEffect(() => {
    // Set up message listener
    window.addEventListener("message", handleMessage);

    // Request initial state when component mounts
    vscode.postMessage({
      command: "getContractInfo",
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
        setContractName(message.contractName || "Unknown Contract");
        setContractFunctions(message.contractFunctions || []);
        setStorageVariables(message.storageVariables || []);
        setStateChanges(message.stateChanges || []);
        break;

      case "updateContractState":
        // Update the current contract state
        setContractState(message.contractState || {});
        break;

      case "functionExecuted":
        // Handle when a function is executed in the simulator
        if (message.stateChanges) {
          setStateChanges((prev) => [...prev, ...message.stateChanges]);
        }
        if (message.newState) {
          setContractState(message.newState);
        }
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
        <div className="header-title">
          <h1>Solidity State Visualizer</h1>
          {contractName && <div className="contract-name">State Visualisation for {contractName}.sol</div>}
        </div>
        
        <VSCodeButton onClick={requestAnalysis}>
          {loading ? "Analyzing..." : "Analyze Current Contract"}
        </VSCodeButton>
      </header>

      <VSCodePanels
        activeid={activeTab}
        onChange={(e: any) => setActiveTab(e.detail.tab)}
      >
        <VSCodePanelTab id="state">State Changes</VSCodePanelTab>
        <VSCodePanelTab id="simulator">Contract Simulator</VSCodePanelTab>
        <VSCodePanelTab id="storage">Storage Layout</VSCodePanelTab>

        <VSCodePanelView id="state">
          {loading ? (
            <div className="loading-container">
              <VSCodeProgressRing />
              <p>Loading contract state...</p>
            </div>
          ) : (
            <ContractStateVisualizer
              stateChanges={stateChanges}
              contractState={contractState}
            />
          )}
        </VSCodePanelView>

        <VSCodePanelView id="simulator">
          {loading ? (
            <div className="loading-container">
              <VSCodeProgressRing />
              <p>Loading contract functions...</p>
            </div>
          ) : contractFunctions.length > 0 ? (
            <ContractSimulator
              contractFunctions={contractFunctions}
              currentState={contractState}
            />
          ) : (
            <div className="empty-state">
              <p>
                No contract functions available. Analyze a contract to use the
                simulator.
              </p>
              <VSCodeButton onClick={requestAnalysis}>
                Analyze Contract
              </VSCodeButton>
            </div>
          )}
        </VSCodePanelView>

        <VSCodePanelView id="storage">
          {loading ? (
            <div className="loading-container">
              <VSCodeProgressRing />
              <p>Loading storage layout...</p>
            </div>
          ) : (
            <StorageLayout variables={storageVariables} />
          )}
        </VSCodePanelView>
      </VSCodePanels>
    </div>
  );
};

export default App;
