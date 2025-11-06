"use client";
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const Page = () => {
    return ((0, jsx_runtime_1.jsxs)("div", { style: {
            minHeight: "100vh",
            backgroundColor: "#0f172a",
            color: "#f1f5f9",
            fontFamily: "system-ui, sans-serif",
        }, children: [(0, jsx_runtime_1.jsx)("header", { style: {
                    borderBottom: "1px solid #475569",
                    padding: "24px 32px",
                    backgroundColor: "#1e293b",
                }, children: (0, jsx_runtime_1.jsxs)("div", { style: { maxWidth: "1200px", margin: "0 auto" }, children: [(0, jsx_runtime_1.jsx)("h1", { style: { fontSize: "28px", fontWeight: "600", margin: "0 0 8px 0" }, children: "Solidity Debugger" }), (0, jsx_runtime_1.jsx)("p", { style: { color: "#cbd5e1", margin: 0 }, children: "Advanced state visualization and simulation for Solidity smart contracts" })] }) }), (0, jsx_runtime_1.jsxs)("main", { style: { maxWidth: "1200px", margin: "0 auto", padding: "48px 32px" }, children: [(0, jsx_runtime_1.jsxs)("section", { style: { marginBottom: "64px", textAlign: "center" }, children: [(0, jsx_runtime_1.jsx)("h2", { style: {
                                    fontSize: "36px",
                                    fontWeight: "700",
                                    marginBottom: "16px",
                                }, children: "Debug Solidity Contracts with Ease" }), (0, jsx_runtime_1.jsx)("p", { style: {
                                    fontSize: "18px",
                                    color: "#cbd5e1",
                                    maxWidth: "600px",
                                    margin: "0 auto 32px",
                                }, children: "A powerful VS Code extension that provides real-time state visualization, function simulation, and gas analysis for your Solidity smart contracts." }), (0, jsx_runtime_1.jsx)("button", { onClick: () => {
                                    const link = document.createElement("a");
                                    link.href = "https://marketplace.visualstudio.com";
                                    link.target = "_blank";
                                    link.click();
                                }, style: {
                                    backgroundColor: "#6366f1",
                                    color: "white",
                                    padding: "12px 32px",
                                    borderRadius: "8px",
                                    border: "none",
                                    fontSize: "16px",
                                    fontWeight: "600",
                                    cursor: "pointer",
                                    transition: "background-color 200ms",
                                }, onMouseEnter: (e) => (e.currentTarget.style.backgroundColor = "#4f46e5"), onMouseLeave: (e) => (e.currentTarget.style.backgroundColor = "#6366f1"), children: "Install from Marketplace" })] }), (0, jsx_runtime_1.jsxs)("section", { style: { marginBottom: "64px" }, children: [(0, jsx_runtime_1.jsx)("h3", { style: {
                                    fontSize: "24px",
                                    fontWeight: "600",
                                    marginBottom: "32px",
                                    textAlign: "center",
                                }, children: "Key Features" }), (0, jsx_runtime_1.jsxs)("div", { style: {
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                                    gap: "24px",
                                }, children: [(0, jsx_runtime_1.jsxs)("div", { style: {
                                            backgroundColor: "#1e293b",
                                            border: "1px solid #475569",
                                            borderRadius: "12px",
                                            padding: "24px",
                                            transition: "all 200ms",
                                        }, onMouseEnter: (e) => {
                                            e.currentTarget.style.borderColor = "#6366f1";
                                            e.currentTarget.style.backgroundColor = "#334155";
                                        }, onMouseLeave: (e) => {
                                            e.currentTarget.style.borderColor = "#475569";
                                            e.currentTarget.style.backgroundColor = "#1e293b";
                                        }, children: [(0, jsx_runtime_1.jsx)("h4", { style: {
                                                    color: "#818cf8",
                                                    marginBottom: "12px",
                                                    fontSize: "18px",
                                                    fontWeight: "600",
                                                }, children: "State Visualization" }), (0, jsx_runtime_1.jsx)("p", { style: { color: "#cbd5e1", lineHeight: "1.6" }, children: "Track contract state changes in real-time with a clear, visual representation of every variable modification." })] }), (0, jsx_runtime_1.jsxs)("div", { style: {
                                            backgroundColor: "#1e293b",
                                            border: "1px solid #475569",
                                            borderRadius: "12px",
                                            padding: "24px",
                                            transition: "all 200ms",
                                        }, onMouseEnter: (e) => {
                                            e.currentTarget.style.borderColor = "#6366f1";
                                            e.currentTarget.style.backgroundColor = "#334155";
                                        }, onMouseLeave: (e) => {
                                            e.currentTarget.style.borderColor = "#475569";
                                            e.currentTarget.style.backgroundColor = "#1e293b";
                                        }, children: [(0, jsx_runtime_1.jsx)("h4", { style: {
                                                    color: "#818cf8",
                                                    marginBottom: "12px",
                                                    fontSize: "18px",
                                                    fontWeight: "600",
                                                }, children: "Function Simulator" }), (0, jsx_runtime_1.jsx)("p", { style: { color: "#cbd5e1", lineHeight: "1.6" }, children: "Simulate contract function execution with automatic input validation and state change simulation." })] }), (0, jsx_runtime_1.jsxs)("div", { style: {
                                            backgroundColor: "#1e293b",
                                            border: "1px solid #475569",
                                            borderRadius: "12px",
                                            padding: "24px",
                                            transition: "all 200ms",
                                        }, onMouseEnter: (e) => {
                                            e.currentTarget.style.borderColor = "#6366f1";
                                            e.currentTarget.style.backgroundColor = "#334155";
                                        }, onMouseLeave: (e) => {
                                            e.currentTarget.style.borderColor = "#475569";
                                            e.currentTarget.style.backgroundColor = "#1e293b";
                                        }, children: [(0, jsx_runtime_1.jsx)("h4", { style: {
                                                    color: "#818cf8",
                                                    marginBottom: "12px",
                                                    fontSize: "18px",
                                                    fontWeight: "600",
                                                }, children: "Gas Analysis" }), (0, jsx_runtime_1.jsx)("p", { style: { color: "#cbd5e1", lineHeight: "1.6" }, children: "Analyze gas usage patterns and receive actionable optimization recommendations for your contracts." })] }), (0, jsx_runtime_1.jsxs)("div", { style: {
                                            backgroundColor: "#1e293b",
                                            border: "1px solid #475569",
                                            borderRadius: "12px",
                                            padding: "24px",
                                            transition: "all 200ms",
                                        }, onMouseEnter: (e) => {
                                            e.currentTarget.style.borderColor = "#6366f1";
                                            e.currentTarget.style.backgroundColor = "#334155";
                                        }, onMouseLeave: (e) => {
                                            e.currentTarget.style.borderColor = "#475569";
                                            e.currentTarget.style.backgroundColor = "#1e293b";
                                        }, children: [(0, jsx_runtime_1.jsx)("h4", { style: {
                                                    color: "#818cf8",
                                                    marginBottom: "12px",
                                                    fontSize: "18px",
                                                    fontWeight: "600",
                                                }, children: "Storage Layout" }), (0, jsx_runtime_1.jsx)("p", { style: { color: "#cbd5e1", lineHeight: "1.6" }, children: "View contract storage layout with detailed slot information and variable type mappings." })] }), (0, jsx_runtime_1.jsxs)("div", { style: {
                                            backgroundColor: "#1e293b",
                                            border: "1px solid #475569",
                                            borderRadius: "12px",
                                            padding: "24px",
                                            transition: "all 200ms",
                                        }, onMouseEnter: (e) => {
                                            e.currentTarget.style.borderColor = "#6366f1";
                                            e.currentTarget.style.backgroundColor = "#334155";
                                        }, onMouseLeave: (e) => {
                                            e.currentTarget.style.borderColor = "#475569";
                                            e.currentTarget.style.backgroundColor = "#1e293b";
                                        }, children: [(0, jsx_runtime_1.jsx)("h4", { style: {
                                                    color: "#818cf8",
                                                    marginBottom: "12px",
                                                    fontSize: "18px",
                                                    fontWeight: "600",
                                                }, children: "Error Handling" }), (0, jsx_runtime_1.jsx)("p", { style: { color: "#cbd5e1", lineHeight: "1.6" }, children: "Comprehensive error tracking with contextual information for debugging and troubleshooting." })] }), (0, jsx_runtime_1.jsxs)("div", { style: {
                                            backgroundColor: "#1e293b",
                                            border: "1px solid #475569",
                                            borderRadius: "12px",
                                            padding: "24px",
                                            transition: "all 200ms",
                                        }, onMouseEnter: (e) => {
                                            e.currentTarget.style.borderColor = "#6366f1";
                                            e.currentTarget.style.backgroundColor = "#334155";
                                        }, onMouseLeave: (e) => {
                                            e.currentTarget.style.borderColor = "#475569";
                                            e.currentTarget.style.backgroundColor = "#1e293b";
                                        }, children: [(0, jsx_runtime_1.jsx)("h4", { style: {
                                                    color: "#818cf8",
                                                    marginBottom: "12px",
                                                    fontSize: "18px",
                                                    fontWeight: "600",
                                                }, children: "Well-Tested" }), (0, jsx_runtime_1.jsx)("p", { style: { color: "#cbd5e1", lineHeight: "1.6" }, children: "Built with comprehensive unit and integration tests for reliability and stability." })] })] })] }), (0, jsx_runtime_1.jsxs)("section", { style: {
                            marginBottom: "64px",
                            backgroundColor: "#1e293b",
                            borderRadius: "12px",
                            padding: "40px",
                            border: "1px solid #475569",
                        }, children: [(0, jsx_runtime_1.jsx)("h3", { style: {
                                    fontSize: "24px",
                                    fontWeight: "600",
                                    marginBottom: "24px",
                                }, children: "Getting Started" }), (0, jsx_runtime_1.jsxs)("div", { style: {
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                                    gap: "24px",
                                }, children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { style: {
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
                                                }, children: "1" }), (0, jsx_runtime_1.jsx)("h4", { style: { marginBottom: "8px" }, children: "Install Extension" }), (0, jsx_runtime_1.jsx)("p", { style: { color: "#cbd5e1", margin: 0 }, children: "Install the Solidity Debugger from the VS Code marketplace." })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { style: {
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
                                                }, children: "2" }), (0, jsx_runtime_1.jsx)("h4", { style: { marginBottom: "8px" }, children: "Open Your Contract" }), (0, jsx_runtime_1.jsx)("p", { style: { color: "#cbd5e1", margin: 0 }, children: "Open any Solidity file in VS Code." })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { style: {
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
                                                }, children: "3" }), (0, jsx_runtime_1.jsx)("h4", { style: { marginBottom: "8px" }, children: "Start Debugging" }), (0, jsx_runtime_1.jsx)("p", { style: { color: "#cbd5e1", margin: 0 }, children: "Right-click and select \"Show State Visualizer\" to begin." })] })] })] }), (0, jsx_runtime_1.jsxs)("section", { style: {
                            textAlign: "center",
                            paddingTop: "32px",
                            borderTop: "1px solid #475569",
                        }, children: [(0, jsx_runtime_1.jsx)("p", { style: { color: "#94a3b8", marginBottom: "16px" }, children: "Solidity Debugger v0.0.1" }), (0, jsx_runtime_1.jsx)("p", { style: { color: "#64748b" }, children: "Built to help developers debug, analyze, and optimize Solidity smart contracts with ease." })] })] })] }));
};
exports.default = Page;
//# sourceMappingURL=page.js.map