# Solidity Debugger with Visualized State Changes

<div align="center">

![Version](https://img.shields.io/badge/version-0.0.1-blue.svg)
![VS Code Version](https://img.shields.io/badge/VS%20Code-%5E1.96.0-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)



[Features](#features) • [Installation](#installation) • [Getting Started](#getting-started) • [Usage](#usage) • [Development](#development) • [Contributing](#contributing)

</div>

---

## 🌟 Features

### 🔍 State Visualization
- **Real-time State Tracking**: Visualize contract state changes during execution
- **Interactive Step-Through**: Step through contract execution with live state updates
- **Before/After Comparison**: See exactly how state variables change
- **Transaction Trace Analysis**: Parse and display storage changes, memory operations, and call stack

### ⛽ Gas Analysis & Optimization
- **Gas Usage Heatmaps**: Visual representation of gas consumption across your contract
- **Optimization Suggestions**: Contextual recommendations for gas efficiency improvements
- **Pattern Detection**: Identify common gas inefficiencies with 10+ optimization patterns
- **Interactive Gas Tour**: Guided walkthrough of gas hotspots in your code

### 🎯 Developer Tools Integration
- **Debug Adapter Protocol**: Full debugging support for Solidity contracts
- **Context Menus**: Quick access to debugging tools from editor context
- **Command Palette**: All features accessible via VS Code commands
- **Webview Panels**: Beautiful, interactive UI for state and gas analysis

### 📚 Educational Features
- **Error Pattern Database**: Solutions for common Solidity errors
- **Contextual Help**: Get help exactly where you need it
- **Interactive Examples**: Learn by doing with built-in examples

---

## 📦 Installation

### From VS Code Marketplace (Coming Soon)
1. Open VS Code
2. Go to Extensions (`Cmd+Shift+X` on macOS, `Ctrl+Shift+X` on Windows/Linux)
3. Search for "Solidity Debugger with Visualized State Changes"
4. Click **Install**

<!-- ### From VSIX (Manual Installation)
1. Download the `.vsix` file from the [releases page](https://github.com/michojekunle/solidity-debugger/releases)
2. Open VS Code
3. Go to Extensions
4. Click the `...` menu → `Install from VSIX...`
5. Select the downloaded `.vsix` file -->

---

## 🏁 Getting Started

### Prerequisites
- **Node.js**: v20.0.0 or higher
- **VS Code**: v1.96.0 or higher
- **npm**: v10.0.0 or higher

### Quick Start

1. **Open a Solidity File**
   ```solidity
   // example.sol
   pragma solidity ^0.8.0;
   
   contract MyContract {
       uint256 public value;
       
       function setValue(uint256 _value) public {
           value = _value;
       }
   }
   ```

2. **Activate the Extension**
   - Open a `.sol` file (extension activates automatically)
   - Or press `Cmd+Shift+P` / `Ctrl+Shift+P` and type "Solidity Debugger"

3. **Analyze Contract State**
   - Right-click in your Solidity file
   - Select `Solidity Debugger: Analyze Contract State`
   - View state changes in the State Visualizer panel

4. **Analyze Gas Usage**
   - Right-click in your Solidity file
   - Select `Solidity Debugger: Analyze Gas Usage`
   - View gas analysis in the Gas Analyzer panel

---

## 🎯 Usage

### Available Commands

Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and search for:

| Command | Description |
|---------|-------------|
| `Solidity Debugger: Show State Visualizer` | Open the state visualization panel |
| `Solidity Debugger: Show Gas Analyzer` | Open the gas analysis panel |
| `Solidity Debugger: Analyze Contract State` | Analyze and display contract state changes |
| `Solidity Debugger: Analyze Gas Usage` | Analyze gas consumption patterns |
| `Solidity Debugger: Start Gas Optimization Tour` | Interactive tour of gas hotspots |
| `State Visualiser: Next Step` | Step to next state change |
| `State Visualiser: Reset State` | Reset state visualizer |

### Context Menu

Right-click on any Solidity file to access:
- Show State Visualizer
- Show Gas Analyzer
- Analyze Contract State
- Analyze Gas Usage
- Start Gas Optimization Tour

### Debugging Configuration

Create a `.vscode/launch.json` file in your project:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "solidityDebug",
      "request": "launch",
      "name": "Debug Solidity Contract",
      "program": "${file}",
      "stopOnEntry": true
    }
  ]
}
```

Then press `F5` to start debugging your Solidity contract.

---

## 🛠 Development

### Local Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/michojekunle/solidity-debugger.git
   cd solidity-debugger
   ```

2. **Install Dependencies**
   ```bash
   npm run install:all
   ```
   This installs dependencies for both the extension and the webview UI.

3. **Compile the Extension**
   ```bash
   npm run compile
   ```

4. **Run in Development Mode**
   - Press `F5` in VS Code to open a new Extension Development Host window
   - Or run the "Run Extension" configuration from the Debug panel

### Project Structure

```
solidity-debugger/
├── src/                    # Extension source code
│   ├── core/              # Core functionality
│   ├── webviews/          # Webview panels
│   ├── utils/             # Utility functions
│   └── extension.ts       # Extension entry point
├── webview-ui/            # React-based webview UI
│   ├── src/
│   └── package.json
├── out/                   # Compiled extension code
├── package.json           # Extension manifest
├── tsconfig.json          # TypeScript configuration
└── README.md              # This file
```

### Available Scripts

```bash
# Install all dependencies (extension + webview)
npm run install:all

# Compile TypeScript
npm run compile

# Watch mode (auto-compile on changes)
npm run watch

# Build webview UI
npm run build:webview

# Run webview dev server
npm run start:webview

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage

# Lint code
npm run lint
```

### Testing

This project uses [Vitest](https://vitest.dev/) for testing. See [TEST_GUIDE.md](./TEST_GUIDE.md) for detailed testing documentation.

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

**Coverage Goals:**
- Lines: 70%
- Functions: 70%
- Branches: 65%
- Statements: 70%

---

## 📤 Publishing to VS Code Marketplace

### Prerequisites

1. **Install `vsce` (VS Code Extension Manager)**
   ```bash
   npm install -g @vscode/vsce
   ```

2. **Create a Publisher Account**
   - Visit [Visual Studio Marketplace Publisher Management](https://marketplace.visualstudio.com/manage)
   - Sign in with your Microsoft account
   - Create a new publisher

3. **Get a Personal Access Token**
   - Go to [Azure DevOps](https://dev.azure.com)
   - Click on User Settings → Personal Access Tokens
   - Create a new token with **Marketplace (Manage)** scope
   - Save the token securely

### Package the Extension

```bash
# Package as .vsix file
vsce package
```

This creates a `solidity-debugger-0.0.1.vsix` file.

### Publish to Marketplace

```bash
# Login to your publisher account
vsce login <your-publisher-name>

# Publish the extension
vsce publish
```

Or publish a specific version:
```bash
vsce publish minor  # 0.0.1 -> 0.1.0
vsce publish major  # 0.0.1 -> 1.0.0
vsce publish patch  # 0.0.1 -> 0.0.2
```

### Pre-Publish Checklist

Before publishing, ensure:
- [ ] All tests pass (`npm test`)
- [ ] Extension compiles without errors (`npm run compile`)
- [ ] Webview UI builds successfully (`npm run build:webview`)
- [ ] Extension icon is added (recommended: 128x128 PNG)
- [ ] README.md is complete and accurate
- [ ] CHANGELOG.md is updated
- [ ] LICENSE file is present
- [ ] `package.json` has all required metadata
- [ ] `.vscodeignore` excludes unnecessary files
- [ ] Extension works in clean VS Code instance

---

## 🏗 Architecture

### Extension Components

1. **Debug Adapter**: Implements Debug Adapter Protocol for Solidity
2. **State Collector**: Tracks and analyzes contract state changes
3. **Gas Estimator**: Analyzes gas consumption and provides optimization suggestions
4. **Contract Simulator**: Simulates contract execution for testing
5. **Webview Panels**: Interactive UI for visualization

### Technology Stack

- **Extension**: TypeScript, VS Code Extension API
- **Webview UI**: React, TypeScript, Vite
- **Blockchain**: ethers.js, web3.js
- **Compiler**: solc (Solidity Compiler)
- **Testing**: Vitest, Jest
- **UI Components**: VS Code Webview UI Toolkit

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Make your changes**
4. **Run tests** (`npm test`)
5. **Commit your changes** (`git commit -m 'Add amazing feature'`)
6. **Push to the branch** (`git push origin feature/amazing-feature`)
7. **Open a Pull Request**

### Contributing Guidelines

- Follow the existing code style
- Write tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting PR
- Keep PRs focused on a single feature/fix

---

## 📋 Roadmap

See [milestones.md](./milestones.md) for the complete development roadmap.

**Upcoming Features:**
- [ ] Hardhat plugin integration
- [ ] Foundry integration
- [ ] Enhanced error pattern database
- [ ] Contract interaction flow diagrams
- [ ] Custom visualization themes
- [ ] Multi-contract debugging
- [ ] Deployment to NPM as standalone tool

---

## 🐛 Known Issues

- State visualization requires valid transaction traces
- Gas analysis works best with Solidity 0.8.x
- Large contracts may take longer to analyze

Report issues at: [GitHub Issues](https://github.com/michojekunle/solidity-debugger/issues)

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

---

## 🙏 Acknowledgments

- Built with [VS Code Extension API](https://code.visualstudio.com/api)
- Powered by [ethers.js](https://docs.ethers.io/)
- UI components from [VS Code Webview UI Toolkit](https://github.com/microsoft/vscode-webview-ui-toolkit)

---

## 📞 Support

- 📧 Email: support@example.com
- 🐛 Issues: [GitHub Issues](https://github.com/michojekunle/solidity-debugger/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/michojekunle/solidity-debugger/discussions)

---

<div align="center">

**[⬆ Back to Top](#solidity-debugger-with-visualized-state-changes)**

Made with ❤️ for the Solidity developer community

</div>
