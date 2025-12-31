# Interactive Gas Analysis - Quick Start Guide

## How to Use the New Gas Tour Feature

### 1. Reload VS Code Extension
After updating the code, you need to reload VS Code to activate the new commands:
- Press `F5` to start the extension in debug mode, OR
- Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac) → "Developer: Reload Window"

### 2. Start the Gas Optimization Tour
There are three ways to start:

**Option A: Command Palette**
1. Open a Solidity file (`.sol`)
2. Press `Ctrl+Shift+P` / `Cmd+Shift+P`
3. Type "Start Gas Optimization Tour"
4. Press Enter

**Option B: Right-Click Menu**
1. Right-click anywhere in a Solidity file
2. Select "Solidity Debugger: Start Gas Optimization Tour"

**Option C: Existing "Analyze Gas Usage" (updated)**
- The existing gas analysis command will show results in the panel
- The new tour provides an interactive, in-editor experience

### 3. Navigate Through Gas Hotspots

Once the tour starts:
- **Next Hotspot**: `Ctrl+Shift+P` → "Gas Tour: Next Hotspot"
- **Previous Hotspot**: `Ctrl+Shift+P` → "Gas Tour: Previous Hotspot"
- **Finish Tour**: `Ctrl+Shift+P` → "Gas Tour: Finish Tour"

### 4. What You'll See

**During the Tour:**
- 🟢 Green highlighting = Optimal gas usage (<1000 gas)
- 🟡 Yellow highlighting = Warning (1000-5000 gas)
- 🟠 Orange highlighting = High (5000-20000 gas)
- 🔴 Red highlighting = Critical (>20000 gas)

**Hover over highlighted code** to see:
- Exact gas cost
- Operations (SLOAD, SSTORE, etc.)
- Optimization recommendations
- Suggested code fixes

**After finishing the tour:**
- Colored squiggly lines remain
- Hover still shows recommendations
- Diagnostics panel shows all issues

### 5. Pattern Detection

The system automatically detects:
- ✅ Repeated `SLOAD` operations → Cache in memory
- ✅ Storage writes in loops → Batch updates
- ✅ Multiple storage reads → Use local variables
- ✅ Expensive external calls → Review necessity

### Example Workflow

```solidity
// Before optimization
function updateBalances(address[] memory users, uint[] memory amounts) public {
    for (uint i = 0; i < users.length; i++) {
        balances[users[i]] = amounts[i]; // ❌ High gas: storage write in loop
    }
}

// After following recommendation
function updateBalances(address[] memory users, uint[] memory amounts) public {
    for (uint i = 0; i < users.length; i++) {
        // Batch operations, then single write
    }
}
```

### Troubleshooting

**Commands not appearing?**
- Ensure you've reloaded VS Code
- Check that `package.json` has been updated
- Try `npm run compile` then reload

**No hotspots found?**
- Contract needs to compile successfully first
- Some simple contracts may have no optimization opportunities
- Check console for error messages

**Compilation errors?**
- Fixed bytecode extraction for ERC20 tokens
- If you still see errors, check that solc is installed
- Try a simpler contract first to test

### Advanced Usage

**Keybindings (Optional)**
You can add custom keybindings in VS Code:
```json
{
  "key": "ctrl+alt+g",
  "command": "solidityDebugger.startGasTour",
  "when": "editorLangId == solidity"
},
{
  "key": "ctrl+alt+n",
  "command": "solidityDebugger.nextGasHotspot"
}
```

### What's Next?

The gas optimizer recommendation engine can be extended with:
- More pattern detection rules
- Automated code fixes
- Integration with gas panel UI
- Runtime trace integration for precise costs
