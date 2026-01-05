# Change Log

All notable changes to the "Solidity Debugger with Visualized State Changes" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.1] - 2026-01-02

### Added

#### Core Features
- **State Visualization**: Real-time visualization of contract state changes during execution
- **Debug Adapter**: Full Debug Adapter Protocol implementation for Solidity contracts
- **Gas Analysis**: Comprehensive gas usage analysis with optimization suggestions
- **Interactive UI**: React-based webview panels for state and gas visualization

#### Commands
- `Solidity Debugger: Show State Visualizer` - Open state visualization panel
- `Solidity Debugger: Show Gas Analyzer` - Open gas analysis panel
- `Solidity Debugger: Analyze Contract State` - Analyze and display contract state changes
- `Solidity Debugger: Analyze Gas Usage` - Analyze gas consumption patterns
- `Solidity Debugger: Start Gas Optimization Tour` - Interactive tour of gas hotspots
- `State Visualiser: Next Step` - Step through state changes
- `State Visualiser: Reset State` - Reset state visualizer

#### Debugging
- Transaction trace parsing for storage changes and memory operations
- Call stack visualization
- Before/after state comparison
- Step-through functionality for contract execution

#### Gas Optimization
- Gas usage heatmaps
- Pattern detection for common gas inefficiencies
- Contextual optimization suggestions
- Interactive gas hotspot tour with navigation

#### Developer Experience
- Context menu integration for Solidity files
- Command palette integration
- Activation on Solidity language files
- Comprehensive error handling and logging

#### Testing
- Vitest-based test suite
- Unit tests for all core modules
- Integration tests for cross-system functionality
- Coverage reporting (70% goal for lines, functions, statements)

#### Documentation
- Comprehensive README with setup and usage instructions
- Publishing guide for VS Code marketplace
- Testing guide with best practices
- Architecture documentation

### Technical Details
- Built with TypeScript and VS Code Extension API
- React + Vite for webview UI
- ethers.js and web3.js for blockchain interactions
- solc for Solidity compilation
- Debug Adapter Protocol implementation

### Known Limitations
- State visualization requires valid transaction traces
- Gas analysis optimized for Solidity 0.8.x
- Large contracts may take longer to analyze

---

## Future Roadmap

### Planned Features
- [ ] Hardhat plugin integration
- [ ] Foundry integration adapters
- [ ] Enhanced error pattern database
- [ ] Contract interaction flow diagrams
- [ ] Custom visualization themes
- [ ] Multi-contract debugging support
- [ ] Deployment to NPM as standalone tool
- [ ] Private beta program
- [ ] Community forum

---

[Unreleased]: https://github.com/michojekunle/solidity-debugger/compare/v0.0.1...HEAD
[0.0.1]: https://github.com/michojekunle/solidity-debugger/releases/tag/v0.0.1