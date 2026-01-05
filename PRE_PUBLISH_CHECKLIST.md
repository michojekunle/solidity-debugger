# Pre-Publishing Checklist

Complete this checklist before publishing to the VS Code Marketplace.

---

## 📋 Essential Files

- [x] **README.md** - Comprehensive documentation ✅
- [x] **LICENSE** - MIT License file ✅
- [x] **CHANGELOG.md** - Release notes and version history ✅
- [x] **package.json** - Complete with all required metadata ✅
- [x] **.vscodeignore** - Excludes unnecessary files ✅
- [x] **media/icon.png** - Extension icon (128x128) ✅

## 📦 Package Configuration

### Required Fields in package.json
- [x] `name` - Extension identifier ✅
- [x] `displayName` - Human-readable name ✅
- [x] `description` - Brief description ✅
- [x] `version` - Current version (semver) ✅
- [x] `publisher` - Publisher ID (must match marketplace account) ✅
- [x] `engines.vscode` - Minimum VS Code version ✅
- [x] `categories` - Extension categories ✅
- [x] `keywords` - Search keywords ✅
- [x] `icon` - Path to icon file ✅
- [x] `repository` - Git repository URL ✅
- [x] `bugs` - Issue tracker URL ✅
- [x] `homepage` - Project homepage URL ✅
- [x] `license` - License type ✅

### Additional Documentation
- [x] **PUBLISHING.md** - Publishing guide ✅
- [x] **CONTRIBUTING.md** - Contribution guidelines ✅
- [x] **QUICKSTART.md** - Quick start guide ✅
- [x] **TEST_GUIDE.md** - Testing documentation ✅

## 🔧 Technical Requirements

### Code Quality
- [ ] **TypeScript compiles without errors**
  ```bash
  npm run compile
  ```

- [ ] **No linting errors**
  ```bash
  npm run lint
  ```

- [ ] **All tests pass**
  ```bash
  npm test
  ```

- [ ] **Test coverage meets goals** (70% for lines, functions, statements)
  ```bash
  npm run test:coverage
  ```

### Build & Package
- [ ] **Webview builds successfully**
  ```bash
  npm run build:webview
  ```

- [ ] **Extension packages without errors**
  ```bash
  npm run package
  ```

- [ ] **Package size is reasonable** (< 50MB recommended)
  ```bash
  ls -lh *.vsix
  ```

- [ ] **Package contents are correct**
  ```bash
  vsce ls
  ```

## 🧪 Testing

### Local Testing
- [ ] **Install VSIX locally and test**
  - Extensions panel → Install from VSIX
  - Test all commands
  - Test webview panels
  - Test debugging features

- [ ] **Test with sample Solidity contracts**
  - Simple storage contract
  - ERC20 token contract
  - Complex multi-function contract

- [ ] **Test all commands work**
  - Show State Visualizer
  - Show Gas Analyzer
  - Analyze Contract State
  - Analyze Gas Usage
  - Start Gas Optimization Tour
  - Debug configuration

- [ ] **Test in clean VS Code instance**
  - No other extensions installed
  - Default settings

### Cross-Platform Testing (if possible)
- [ ] **macOS** - Tested and working
- [ ] **Windows** - Tested and working
- [ ] **Linux** - Tested and working

## 🎨 Visual Assets

- [x] **Extension icon exists** (media/icon.png) ✅
- [ ] **Icon is high quality** (128x128 PNG, not blurry)
- [ ] **Screenshots for README** (optional but recommended)
- [ ] **Demo GIF/video** (optional but highly recommended)

## 📝 Documentation

### README.md
- [x] **Clear feature description** ✅
- [x] **Installation instructions** ✅
- [x] **Usage examples** ✅
- [x] **Configuration guide** ✅
- [x] **Commands list** ✅
- [x] **Development setup** ✅
- [x] **Contributing guidelines link** ✅
- [ ] **Screenshots/GIFs** (recommended)
- [ ] **Badge for marketplace** (add after publishing)

### CHANGELOG.md
- [x] **Current version documented** ✅
- [x] **All features listed** ✅
- [x] **Known limitations documented** ✅
- [x] **Future roadmap included** ✅

## 🔐 Marketplace Setup

### Publisher Account
- [ ] **Microsoft account created**
- [ ] **Publisher created on marketplace**
  - Visit: https://marketplace.visualstudio.com/manage
- [ ] **Publisher name matches package.json**
  - package.json: `"publisher": "michojekunle"`
  - Marketplace: Publisher ID must be `michojekunle`

### Personal Access Token
- [ ] **Azure DevOps account created**
- [ ] **Personal Access Token created**
  - Scope: Marketplace (Manage)
  - Validity: 1 year recommended
- [ ] **Token stored securely**
  - Do NOT commit to Git
  - Store in password manager

### Authentication
- [ ] **Logged in with vsce**
  ```bash
  vsce login michojekunle
  ```

## 🚀 Pre-Publishing Steps

### Version Management
- [ ] **Version number updated** in package.json
  - Current: 0.0.1
  - Follow semantic versioning

- [ ] **CHANGELOG.md updated** with new version
  - Date added
  - All changes documented

- [ ] **Git commit and tag**
  ```bash
  git add .
  git commit -m "chore: prepare v0.0.1 for release"
  git tag v0.0.1
  git push origin main --tags
  ```

### Final Build
- [ ] **Clean build**
  ```bash
  npm run clean
  npm run rebuild
  ```

- [ ] **Final package**
  ```bash
  npm run package
  ```

### Final Checks
- [ ] **No sensitive information in code**
  - No API keys
  - No passwords
  - No private URLs

- [ ] **No placeholder text**
  - No "TODO" in user-facing text
  - No "FIXME" in production code
  - No dummy email addresses

- [ ] **.vscodeignore is complete**
  - Source files excluded
  - Tests excluded
  - Development files excluded
  - node_modules excluded

## 📤 Publishing

### Publish to Marketplace
- [ ] **Publish command executed**
  ```bash
  npm run publish
  ```
  OR
  ```bash
  vsce publish
  ```

- [ ] **Extension appears on marketplace**
  - URL: `https://marketplace.visualstudio.com/items?itemName=michojekunle.solidity-debugger`

- [ ] **Marketplace page looks correct**
  - Icon displays properly
  - README renders correctly
  - Version number is correct

### Post-Publishing
- [ ] **Install from marketplace**
  - Search "Solidity Debugger" in VS Code
  - Install and verify it works

- [ ] **Create GitHub release**
  - Include .vsix file
  - Copy CHANGELOG content

- [ ] **Update README badges**
  - Add marketplace version badge
  - Add install count badge

- [ ] **Announce release**
  - Social media (optional)
  - Developer communities (optional)
  - Documentation site (if applicable)

## 📊 Monitoring

### Post-Release
- [ ] **Monitor marketplace statistics**
  - Install count
  - Ratings
  - Reviews

- [ ] **Monitor GitHub issues**
  - Respond to bug reports
  - Address critical issues quickly

- [ ] **Gather feedback**
  - User reviews
  - GitHub discussions
  - Direct feedback

## 🛠 Troubleshooting

### Common Issues

**Issue: "Invalid publisher name"**
- ✅ Ensure `package.json` publisher matches marketplace publisher ID exactly

**Issue: "Extension icon not found"**
- ✅ Verify `media/icon.png` exists
- ✅ Check `icon` path in `package.json`

**Issue: "Package too large"**
- ✅ Review `.vscodeignore`
- ✅ Run `vsce ls` to see included files
- ✅ Ensure node_modules are excluded

**Issue: "Command failed with exit code 1"**
- ✅ Run `npm run compile` first
- ✅ Check for TypeScript errors
- ✅ Ensure all dependencies installed

## ✅ Final Sign-Off

Before publishing, confirm:

- [ ] I have completed **all items** in this checklist
- [ ] I have tested the extension **thoroughly**
- [ ] I have reviewed the **package contents**
- [ ] I am ready to **publish to production**

---

## 🎯 Quick Commands Reference

```bash
# Install vsce globally
npm install -g @vscode/vsce

# Clean and rebuild everything
npm run clean && npm run rebuild

# Run all tests
npm test

# Package extension
npm run package

# Check package contents
vsce ls

# Login to marketplace
vsce login michojekunle

# Publish extension
npm run publish

# Publish with version bump
vsce publish patch  # 0.0.1 -> 0.0.2
vsce publish minor  # 0.0.1 -> 0.1.0
vsce publish major  # 0.0.1 -> 1.0.0
```

---

**Ready to publish?** Run through this checklist one more time, then execute:

```bash
npm run publish
```

Good luck! 🚀
