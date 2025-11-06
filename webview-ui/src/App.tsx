"use client";

import type React from "react";
import { useEffect, useState, useCallback } from "react";
import { vscode } from "./vscode";
import {
  VSCodeButton,
  VSCodePanels,
  VSCodePanelTab,
  VSCodePanelView,
} from "@vscode/webview-ui-toolkit/react";
import ContractStateVisualizer from "./components/ContractStateVisualiser";
import ContractSimulator from "./components/ContractSimulator";
import StorageLayout from "./components/StorageLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import LoadingSpinner from "./components/LoadingSpinner";
import ErrorAlert from "./components/ErrorAlert";
import type {
  StateChange,
  ContractFunction,
  ContractState,
  StorageVariable,
} from "./types";

const App: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<{ code: string; message: string } | null>(
    null
  );
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
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const [isAnalyzed, setIsAnalyzed] = useState<boolean>(false);

  useEffect(() => {
    window.addEventListener("message", handleMessage);

    vscode.postMessage({
      command: "getContractInfo",
    });

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  const handleMessage = useCallback((event: MessageEvent) => {
    const message = event.data;

    switch (message.command) {
      case "updateStateChanges":
        setStateChanges(message.stateChanges || []);
        setLoading(false);
        setLastUpdate(Date.now());
        break;

      case "contractAnalyzed":
        setLoading(false);
        setError(null);
        setContractName(message.contractName || "Unknown Contract");
        setContractFunctions(message.contractFunctions || []);
        setStorageVariables(message.storageVariables || []);
        setStateChanges(message.stateChanges || []);
        setIsAnalyzed(true);
        setLastUpdate(Date.now());
        break;

      case "updateContractState":
        setContractState(message.contractState || {});
        setLastUpdate(Date.now());
        break;

      case "functionExecuted":
        if (message.stateChanges) {
          setStateChanges((prev) => [...prev, ...message.stateChanges]);
        }
        if (message.newState) {
          setContractState(message.newState);
        }
        setAnalyzing(false);
        setLastUpdate(Date.now());
        break;

      case "error":
        setError({ code: message.code, message: message.message });
        setLoading(false);
        setAnalyzing(false);
        break;
    }
  }, []);

  const requestAnalysis = useCallback(() => {
    setLoading(true);
    setError(null);
    setAnalyzing(true);
    vscode.postMessage({
      command: "analyzeContract",
    });
  }, []);

  const getLastUpdateDisplay = () => {
    if (lastUpdate === 0) return "";
    const now = Date.now();
    const diff = Math.floor((now - lastUpdate) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  return (
    <ErrorBoundary>
      <div className="app-container">
        <header className="app-header">
          <div className="header-content">
            <h1>Solidity Debugger</h1>
            {contractName && (
              <div className="contract-info">
                <span className="contract-name">{contractName}.sol</span>
                {isAnalyzed && (
                  <span className="contract-status analyzed">Analyzed</span>
                )}
                {lastUpdate > 0 && (
                  <span className="last-update">
                    Updated {getLastUpdateDisplay()}
                  </span>
                )}
              </div>
            )}
          </div>

          {!isAnalyzed && (
            <VSCodeButton
              onClick={requestAnalysis}
              disabled={loading || analyzing}
              className="analyze-btn"
            >
              {loading || analyzing ? "Analyzing..." : "Analyze Contract"}
            </VSCodeButton>
          )}
        </header>

        {error && <ErrorAlert error={error} onDismiss={() => setError(null)} />}

        {loading && (
          <LoadingSpinner
            message={
              analyzing ? "Executing function..." : "Loading contract data..."
            }
          />
        )}

        {!loading && isAnalyzed && (
          <VSCodePanels
            activeid={activeTab}
            onChange={(e: any) => setActiveTab(e.detail.tab)}
          >
            <VSCodePanelTab id="state">
              <span>State Changes</span>
              {stateChanges.length > 0 && (
                <span className="tab-badge">{stateChanges.length}</span>
              )}
            </VSCodePanelTab>
            <VSCodePanelTab id="simulator">
              <span>Simulator</span>
              {contractFunctions.length > 0 && (
                <span className="tab-badge">{contractFunctions.length}</span>
              )}
            </VSCodePanelTab>
            <VSCodePanelTab id="storage">
              <span>Storage</span>
              {storageVariables.length > 0 && (
                <span className="tab-badge">{storageVariables.length}</span>
              )}
            </VSCodePanelTab>

            <VSCodePanelView id="state">
              <ContractStateVisualizer
                stateChanges={stateChanges}
                contractState={contractState}
              />
            </VSCodePanelView>

            <VSCodePanelView id="simulator">
              {contractFunctions.length > 0 ? (
                <ContractSimulator
                  contractFunctions={contractFunctions}
                  currentState={contractState}
                  onExecuting={setAnalyzing}
                />
              ) : (
                <div className="empty-state">
                  <p>No contract functions available.</p>
                  <VSCodeButton onClick={requestAnalysis}>
                    Analyze Contract
                  </VSCodeButton>
                </div>
              )}
            </VSCodePanelView>

            <VSCodePanelView id="storage">
              <StorageLayout variables={storageVariables} />
            </VSCodePanelView>
          </VSCodePanels>
        )}

        {!loading && !isAnalyzed && !error && (
          <div className="empty-state welcome">
            <h2>Welcome to Solidity Debugger</h2>
            <p>
              Analyze a Solidity contract to get started with state
              visualization and simulation.
            </p>
            <VSCodeButton onClick={requestAnalysis}>
              Analyze Contract
            </VSCodeButton>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default App;
