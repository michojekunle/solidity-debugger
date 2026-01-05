# Quick Start Guide - Solidity Debugger

Get started with the Solidity Debugger extension in less than 5 minutes!

---

## 📥 Installation

### From VS Code Marketplace (Recommended)

1. Open **VS Code**
2. Press `Cmd+Shift+X` (macOS) or `Ctrl+Shift+X` (Windows/Linux) to open Extensions
3. Search for **"Solidity Debugger"**
4. Click **Install**
5. Reload VS Code when prompted

### Manual Installation

1. Download the `.vsix` file from [Releases](https://github.com/michojekunle/solidity-debugger/releases)
2. Open VS Code
3. Press `Cmd+Shift+P` / `Ctrl+Shift+P` to open Command Palette
4. Type "Install from VSIX"
5. Select the downloaded `.vsix` file

---

## ⚡ Quick Usage

### 1. Open a Solidity File

Create or open a `.sol` file:

```solidity
// HelloWorld.sol
pragma solidity ^0.8.0;

contract HelloWorld {
    string public message = "Hello, World!";
    
    function setMessage(string memory _message) public {
        message = _message;
    }
}
```

### 2. Analyze Contract State

**Method 1: Context Menu**
1. Right-click anywhere in your Solidity file
2. Select **"Solidity Debugger: Analyze Contract State"**
3. View results in the State Visualizer panel

**Method 2: Command Palette**
1. Press `Cmd+Shift+P` / `Ctrl+Shift+P`
2. Type "Analyze Contract State"
3. Press Enter

### 3. View Gas Analysis

**Method 1: Context Menu**
1. Right-click in your Solidity file
2. Select **"Solidity Debugger: Analyze Gas Usage"**
3. View results in the Gas Analyzer panel

**Method 2: Command Palette**
1. Press `Cmd+Shift+P` / `Ctrl+Shift+P`
2. Type "Analyze Gas Usage"
3. Press Enter

### 4. Start Gas Optimization Tour

1. Open a Solidity contract with functions
2. Right-click and select **"Solidity Debugger: Start Gas Optimization Tour"**
3. Follow the interactive tour to discover gas hotspots
4. Use **Next Hotspot** / **Previous Hotspot** to navigate

---

## 🎯 Key Features

### State Visualization
- See how contract state changes during execution
- Before/after comparison of state variables
- Step-through contract execution
- Visual representation of state transitions

### Gas Optimization
- Identify gas-intensive operations
- Get optimization suggestions
- Visual heatmaps of gas consumption
- Learn best practices for gas efficiency

### Debugging
- Set breakpoints in Solidity code
- Step through contract execution
- Inspect variables and state
- View call stack and transaction traces

---

## 🛠 Setting Up Debugging

### 1. Create Debug Configuration

Create `.vscode/launch.json` in your project:

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

### 2. Start Debugging

1. Open your Solidity file
2. Set breakpoints by clicking left of line numbers
3. Press `F5` or click **Run > Start Debugging**
4. Use debugging controls:
   - `F10` - Step Over
   - `F11` - Step Into
   - `Shift+F11` - Step Out
   - `F5` - Continue

---

## 📋 Common Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| Show State Visualizer | - | Open state visualization panel |
| Show Gas Analyzer | - | Open gas analysis panel |
| Analyze Contract State | - | Analyze and visualize state changes |
| Analyze Gas Usage | - | Analyze gas consumption |
| Start Gas Tour | - | Interactive gas optimization tour |
| Start Debugging | `F5` | Start debugging session |

**Access all commands:**
- Press `Cmd+Shift+P` / `Ctrl+Shift+P`
- Type "Solidity Debugger"

---

## 💡 Tips & Tricks

### Keyboard Shortcuts

You can create custom shortcuts for frequently used commands:

1. Press `Cmd+K Cmd+S` / `Ctrl+K Ctrl+S` to open Keyboard Shortcuts
2. Search for "Solidity Debugger"
3. Click the `+` icon to add a custom shortcut

### Recommended Settings

Add to your VS Code `settings.json`:

```json
{
  "solidity.compileUsingRemoteVersion": "v0.8.20",
  "solidity.enableLocalNodeCompiler": false,
  "editor.formatOnSave": true
}
```

### Sample Contracts

Try the extension with these sample contracts:

**ERC20 Token:**
```solidity
pragma solidity ^0.8.0;

contract SimpleToken {
    mapping(address => uint256) public balances;
    
    function transfer(address to, uint256 amount) public {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        balances[to] += amount;
    }
    
    function mint(address to, uint256 amount) public {
        balances[to] += amount;
    }
}
```

**Storage Contract:**
```solidity
pragma solidity ^0.8.0;

contract Storage {
    uint256 public value;
    
    function setValue(uint256 _value) public {
        value = _value;
    }
    
    function increment() public {
        value += 1;
    }
}
```

---

## 🚨 Troubleshooting

### Extension Not Activating

**Issue:** Extension doesn't activate when opening Solidity files

**Solution:**
1. Check file extension is `.sol`
2. Reload VS Code window: `Cmd+Shift+P` > "Reload Window"
3. Check extension is enabled: Extensions panel > Search "Solidity Debugger"

### Commands Not Appearing

**Issue:** Can't find Solidity Debugger commands

**Solution:**
1. Open a `.sol` file first
2. Extension activates only for Solidity files
3. Check Command Palette: `Cmd+Shift+P` > Type "Solidity Debugger"

### Compilation Errors

**Issue:** Contract fails to compile

**Solution:**
1. Check Solidity syntax is correct
2. Ensure `pragma solidity` version is specified
3. Check compiler version in settings
4. View output in "Output" panel > "Solidity Debugger"

### No State Changes Shown

**Issue:** State Visualizer shows no changes

**Solution:**
1. Ensure contract has state-changing functions
2. Check that analysis completed successfully
3. Look for errors in Output panel
4. Try a simpler contract first

---

## 📚 Next Steps

### Learn More
- Read the full [README](README.md) for comprehensive documentation
- Check out [milestones](milestones.md) for upcoming features
- Review [Testing Guide](TEST_GUIDE.md) if contributing

### Get Help
- [GitHub Issues](https://github.com/michojekunle/solidity-debugger/issues) - Report bugs
- [GitHub Discussions](https://github.com/michojekunle/solidity-debugger/discussions) - Ask questions
- [Contributing Guide](CONTRIBUTING.md) - Contribute to the project

### Contribute
- Star the project on GitHub ⭐
- Report bugs and request features
- Submit pull requests
- Share with the Solidity community

---

## 🎉 You're Ready!

You now have the Solidity Debugger up and running. Start debugging your smart contracts with visualized state changes and gas optimization insights!

**Happy Debugging! 🚀**

---

**Stuck?** Open an [issue](https://github.com/michojekunle/solidity-debugger/issues) and we'll help you out!
