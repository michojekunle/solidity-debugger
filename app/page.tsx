"use client";

import type React from "react";

const Page: React.FC = () => {
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#0f172a",
        color: "#f1f5f9",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <header
        style={{
          borderBottom: "1px solid #475569",
          padding: "24px 32px",
          backgroundColor: "#1e293b",
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <h1
            style={{ fontSize: "28px", fontWeight: "600", margin: "0 0 8px 0" }}
          >
            Solidity Debugger
          </h1>
          <p style={{ color: "#cbd5e1", margin: 0 }}>
            Advanced state visualization and simulation for Solidity smart
            contracts
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main
        style={{ maxWidth: "1200px", margin: "0 auto", padding: "48px 32px" }}
      >
        {/* Hero Section */}
        <section style={{ marginBottom: "64px", textAlign: "center" }}>
          <h2
            style={{
              fontSize: "36px",
              fontWeight: "700",
              marginBottom: "16px",
            }}
          >
            Debug Solidity Contracts with Ease
          </h2>
          <p
            style={{
              fontSize: "18px",
              color: "#cbd5e1",
              maxWidth: "600px",
              margin: "0 auto 32px",
            }}
          >
            A powerful VS Code extension that provides real-time state
            visualization, function simulation, and gas analysis for your
            Solidity smart contracts.
          </p>
          <button
            onClick={() => {
              const link = document.createElement("a");
              link.href = "https://marketplace.visualstudio.com";
              link.target = "_blank";
              link.click();
            }}
            style={{
              backgroundColor: "#6366f1",
              color: "white",
              padding: "12px 32px",
              borderRadius: "8px",
              border: "none",
              fontSize: "16px",
              fontWeight: "600",
              cursor: "pointer",
              transition: "background-color 200ms",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "#4f46e5")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "#6366f1")
            }
          >
            Install from Marketplace
          </button>
        </section>

        {/* Features Grid */}
        <section style={{ marginBottom: "64px" }}>
          <h3
            style={{
              fontSize: "24px",
              fontWeight: "600",
              marginBottom: "32px",
              textAlign: "center",
            }}
          >
            Key Features
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "24px",
            }}
          >
            {/* Feature Card 1 */}
            <div
              style={{
                backgroundColor: "#1e293b",
                border: "1px solid #475569",
                borderRadius: "12px",
                padding: "24px",
                transition: "all 200ms",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#6366f1";
                e.currentTarget.style.backgroundColor = "#334155";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#475569";
                e.currentTarget.style.backgroundColor = "#1e293b";
              }}
            >
              <h4
                style={{
                  color: "#818cf8",
                  marginBottom: "12px",
                  fontSize: "18px",
                  fontWeight: "600",
                }}
              >
                State Visualization
              </h4>
              <p style={{ color: "#cbd5e1", lineHeight: "1.6" }}>
                Track contract state changes in real-time with a clear, visual
                representation of every variable modification.
              </p>
            </div>

            {/* Feature Card 2 */}
            <div
              style={{
                backgroundColor: "#1e293b",
                border: "1px solid #475569",
                borderRadius: "12px",
                padding: "24px",
                transition: "all 200ms",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#6366f1";
                e.currentTarget.style.backgroundColor = "#334155";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#475569";
                e.currentTarget.style.backgroundColor = "#1e293b";
              }}
            >
              <h4
                style={{
                  color: "#818cf8",
                  marginBottom: "12px",
                  fontSize: "18px",
                  fontWeight: "600",
                }}
              >
                Function Simulator
              </h4>
              <p style={{ color: "#cbd5e1", lineHeight: "1.6" }}>
                Simulate contract function execution with automatic input
                validation and state change simulation.
              </p>
            </div>

            {/* Feature Card 3 */}
            <div
              style={{
                backgroundColor: "#1e293b",
                border: "1px solid #475569",
                borderRadius: "12px",
                padding: "24px",
                transition: "all 200ms",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#6366f1";
                e.currentTarget.style.backgroundColor = "#334155";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#475569";
                e.currentTarget.style.backgroundColor = "#1e293b";
              }}
            >
              <h4
                style={{
                  color: "#818cf8",
                  marginBottom: "12px",
                  fontSize: "18px",
                  fontWeight: "600",
                }}
              >
                Gas Analysis
              </h4>
              <p style={{ color: "#cbd5e1", lineHeight: "1.6" }}>
                Analyze gas usage patterns and receive actionable optimization
                recommendations for your contracts.
              </p>
            </div>

            {/* Feature Card 4 */}
            <div
              style={{
                backgroundColor: "#1e293b",
                border: "1px solid #475569",
                borderRadius: "12px",
                padding: "24px",
                transition: "all 200ms",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#6366f1";
                e.currentTarget.style.backgroundColor = "#334155";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#475569";
                e.currentTarget.style.backgroundColor = "#1e293b";
              }}
            >
              <h4
                style={{
                  color: "#818cf8",
                  marginBottom: "12px",
                  fontSize: "18px",
                  fontWeight: "600",
                }}
              >
                Storage Layout
              </h4>
              <p style={{ color: "#cbd5e1", lineHeight: "1.6" }}>
                View contract storage layout with detailed slot information and
                variable type mappings.
              </p>
            </div>

            {/* Feature Card 5 */}
            <div
              style={{
                backgroundColor: "#1e293b",
                border: "1px solid #475569",
                borderRadius: "12px",
                padding: "24px",
                transition: "all 200ms",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#6366f1";
                e.currentTarget.style.backgroundColor = "#334155";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#475569";
                e.currentTarget.style.backgroundColor = "#1e293b";
              }}
            >
              <h4
                style={{
                  color: "#818cf8",
                  marginBottom: "12px",
                  fontSize: "18px",
                  fontWeight: "600",
                }}
              >
                Error Handling
              </h4>
              <p style={{ color: "#cbd5e1", lineHeight: "1.6" }}>
                Comprehensive error tracking with contextual information for
                debugging and troubleshooting.
              </p>
            </div>

            {/* Feature Card 6 */}
            <div
              style={{
                backgroundColor: "#1e293b",
                border: "1px solid #475569",
                borderRadius: "12px",
                padding: "24px",
                transition: "all 200ms",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#6366f1";
                e.currentTarget.style.backgroundColor = "#334155";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#475569";
                e.currentTarget.style.backgroundColor = "#1e293b";
              }}
            >
              <h4
                style={{
                  color: "#818cf8",
                  marginBottom: "12px",
                  fontSize: "18px",
                  fontWeight: "600",
                }}
              >
                Well-Tested
              </h4>
              <p style={{ color: "#cbd5e1", lineHeight: "1.6" }}>
                Built with comprehensive unit and integration tests for
                reliability and stability.
              </p>
            </div>
          </div>
        </section>

        {/* Getting Started */}
        <section
          style={{
            marginBottom: "64px",
            backgroundColor: "#1e293b",
            borderRadius: "12px",
            padding: "40px",
            border: "1px solid #475569",
          }}
        >
          <h3
            style={{
              fontSize: "24px",
              fontWeight: "600",
              marginBottom: "24px",
            }}
          >
            Getting Started
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "24px",
            }}
          >
            <div>
              <div
                style={{
                  backgroundColor: "#334155",
                  width: "48px",
                  height: "48px",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "16px",
                  color: "#818cf8",
                  fontSize: "24px",
                  fontWeight: "600",
                }}
              >
                1
              </div>
              <h4 style={{ marginBottom: "8px" }}>Install Extension</h4>
              <p style={{ color: "#cbd5e1", margin: 0 }}>
                Install the Solidity Debugger from the VS Code marketplace.
              </p>
            </div>
            <div>
              <div
                style={{
                  backgroundColor: "#334155",
                  width: "48px",
                  height: "48px",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "16px",
                  color: "#818cf8",
                  fontSize: "24px",
                  fontWeight: "600",
                }}
              >
                2
              </div>
              <h4 style={{ marginBottom: "8px" }}>Open Your Contract</h4>
              <p style={{ color: "#cbd5e1", margin: 0 }}>
                Open any Solidity file in VS Code.
              </p>
            </div>
            <div>
              <div
                style={{
                  backgroundColor: "#334155",
                  width: "48px",
                  height: "48px",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "16px",
                  color: "#818cf8",
                  fontSize: "24px",
                  fontWeight: "600",
                }}
              >
                3
              </div>
              <h4 style={{ marginBottom: "8px" }}>Start Debugging</h4>
              <p style={{ color: "#cbd5e1", margin: 0 }}>
                Right-click and select "Show State Visualizer" to begin.
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <section
          style={{
            textAlign: "center",
            paddingTop: "32px",
            borderTop: "1px solid #475569",
          }}
        >
          <p style={{ color: "#94a3b8", marginBottom: "16px" }}>
            Solidity Debugger v0.0.1
          </p>
          <p style={{ color: "#64748b" }}>
            Built to help developers debug, analyze, and optimize Solidity smart
            contracts with ease.
          </p>
        </section>
      </main>
    </div>
  );
};

export default Page;
