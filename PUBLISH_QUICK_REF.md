# 🚀 Publishing Quick Reference

**One-page reference for publishing the Solidity Debugger extension**

---

## ⚡ Quick Start Commands

```bash
# 1. Install dependencies
npm run install:all

# 2. Build everything
npm run compile
npm run build:webview

# 3. Run tests
npm test

# 4. Package extension
npm run package

# 5. Publish to marketplace
npm run publish
```

---

## 📋 Pre-Flight Checklist

- [ ] Update email in `package.json` (line 8)
- [ ] All tests pass: `npm test`
- [ ] Code compiles: `npm run compile`
- [ ] Webview builds: `npm run build:webview`
- [ ] No lint errors: `npm run lint`
- [ ] Package created: `npm run package`
- [ ] VSIX tested locally
- [ ] CHANGELOG.md updated
- [ ] Git tagged: `git tag v0.0.1`

---

## 🔐 Marketplace Setup

### 1. Create Publisher
- Visit: https://marketplace.visualstudio.com/manage
- Sign in with Microsoft account
- Create publisher: `michojekunle`

### 2. Get Personal Access Token
- Visit: https://dev.azure.com
- User Settings → Personal Access Tokens
- Create token with **Marketplace (Manage)** scope
- Copy and save securely

### 3. Login
```bash
vsce login michojekunle
# Enter your PAT when prompted
```

---

## 📦 Publishing Process

### First Time
```bash
# Ensure everything is ready
npm run rebuild

# Package
npm run package

# Test the VSIX locally first!
# Extensions panel → Install from VSIX

# If all good, publish
npm run publish
```

### Updates
```bash
# For bug fixes (0.0.1 → 0.0.2)
vsce publish patch

# For new features (0.0.1 → 0.1.0)
vsce publish minor

# For breaking changes (0.0.1 → 1.0.0)
vsce publish major
```

---

## 🔄 Version Update Workflow

```bash
# 1. Make changes
git checkout -b feature/my-feature

# 2. Update CHANGELOG.md

# 3. Commit
git commit -m "feat: add new feature"

# 4. Merge to main
git checkout main
git merge feature/my-feature

# 5. Tag release
git tag v0.1.0

# 6. Push
git push origin main --tags

# 7. Publish
vsce publish
```

---

## 📂 Important Files

| File | Purpose |
|------|---------|
| `package.json` | Extension metadata |
| `README.md` | User documentation |
| `CHANGELOG.md` | Release notes |
| `LICENSE` | MIT License |
| `.vscodeignore` | Files to exclude from package |
| `media/icon.png` | Extension icon |

---

## 🛑 Common Issues

### "Invalid publisher name"
→ Ensure `package.json` publisher matches marketplace ID

### "Extension icon not found"
→ Check `media/icon.png` exists

### "Package too large"
→ Review `.vscodeignore`, run `vsce ls`

### "TypeError: Cannot read property..."
→ Run `npm run compile` first

---

## 📊 After Publishing

### Verify
1. Visit: `https://marketplace.visualstudio.com/items?itemName=michojekunle.solidity-debugger`
2. Install from VS Code marketplace
3. Test all features

### Monitor
- Install count
- Ratings and reviews
- GitHub issues

---

## 📞 Resources

- **Full Guide**: `PUBLISHING.md`
- **Checklist**: `PRE_PUBLISH_CHECKLIST.md`
- **Setup Summary**: `SETUP_SUMMARY.md`
- **Quick Start**: `QUICKSTART.md`
- **Contributing**: `CONTRIBUTING.md`

---

## 🎯 Ready to Publish?

**Required:**
- ✅ Publisher account created
- ✅ Personal Access Token obtained
- ✅ All tests passing
- ✅ Email updated in package.json

**Command:**
```bash
npm run publish
```

---

**Good luck! 🚀**
