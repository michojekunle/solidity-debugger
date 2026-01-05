# Publishing Guide - VS Code Marketplace

This guide walks you through the complete process of publishing the Solidity Debugger extension to the VS Code Marketplace.

---

## Prerequisites

### 1. Install vsce (VS Code Extension Manager)

```bash
npm install -g @vscode/vsce
```

`vsce` is the official command-line tool for packaging, publishing, and managing VS Code extensions.

### 2. Create a Publisher Account

1. Visit [Visual Studio Marketplace Publisher Management](https://marketplace.visualstudio.com/manage)
2. Sign in with your **Microsoft account** (create one if you don't have it)
3. Click **Create publisher**
4. Fill in the required information:
   - **Name**: Your unique publisher ID (e.g., `michojekunle`)
   - **Display Name**: Your public display name
   - **Email**: Contact email
   - **Personal Website** (optional)

> ⚠️ **Important**: The publisher name in `package.json` must match your publisher ID exactly.

### 3. Get a Personal Access Token (PAT)

1. Go to [Azure DevOps](https://dev.azure.com)
2. Sign in with the **same Microsoft account** used for the marketplace
3. Click on your profile icon → **Personal Access Tokens**
4. Click **+ New Token**
5. Configure the token:
   - **Name**: `VSCode Extension Publishing`
   - **Organization**: Select your organization (or "All accessible organizations")
   - **Expiration**: Custom defined (recommended: 1 year)
   - **Scopes**: Select **Custom defined**
     - Check **Marketplace** → **Manage**
6. Click **Create**
7. **Copy the token immediately** - you won't be able to see it again!
8. Store it securely (e.g., in a password manager)

---

## Pre-Publishing Checklist

Before publishing, ensure all these items are completed:

### Code Quality
- [ ] All tests pass: `npm test`
- [ ] Test coverage meets goals: `npm run test:coverage`
- [ ] Extension compiles without errors: `npm run compile`
- [ ] Webview UI builds successfully: `npm run build:webview`
- [ ] No linting errors: `npm run lint`

### Package Configuration
- [ ] `package.json` has all required fields:
  - `name`, `displayName`, `description`
  - `version` (follow [semver](https://semver.org/))
  - `publisher` (matches your publisher ID)
  - `engines.vscode` (minimum VS Code version)
  - `repository`, `bugs`, `homepage`
  - `keywords` (for discoverability)
  - `categories`
  - `icon` path
  - `license`
- [ ] `README.md` is comprehensive and well-formatted
- [ ] `CHANGELOG.md` is updated with release notes
- [ ] `LICENSE` file exists
- [ ] Extension icon exists at `media/icon.png` (128x128 PNG recommended)

### Files & Exclusions
- [ ] `.vscodeignore` properly excludes:
  - Source files (`src/**`)
  - Development dependencies
  - Test files
  - Configuration files
  - `node_modules`
- [ ] Only compiled output (`out/**`) is included

### Testing
- [ ] Test in a clean VS Code instance
- [ ] Test all commands work correctly
- [ ] Test webview panels render properly
- [ ] Test with sample Solidity files
- [ ] Test debug configuration works

---

## Step-by-Step Publishing Process

### Step 1: Prepare the Extension

1. **Ensure webview is built:**
   ```bash
   cd webview-ui
   npm run build
   cd ..
   ```

2. **Compile the extension:**
   ```bash
   npm run compile
   ```

3. **Run final tests:**
   ```bash
   npm test
   ```

4. **Clean any temporary files:**
   ```bash
   # Remove any test artifacts, logs, etc.
   rm -rf *.log
   ```

### Step 2: Update Version and Changelog

1. **Update version in `package.json`:**
   ```json
   {
     "version": "0.1.0"  // Update as appropriate
   }
   ```

2. **Update `CHANGELOG.md`:**
   ```markdown
   ## [0.1.0] - 2026-01-02
   
   ### Added
   - Initial release
   - State visualization
   - Gas analysis
   - Debug adapter
   ```

3. **Commit the changes:**
   ```bash
   git add package.json CHANGELOG.md
   git commit -m "chore: bump version to 0.1.0"
   git tag v0.1.0
   git push origin main --tags
   ```

### Step 3: Package the Extension

```bash
vsce package
```

This creates a `.vsix` file (e.g., `solidity-debugger-0.1.0.vsix`).

**Verify the package:**
```bash
# List contents of the package
vsce ls

# Check package size (should be < 50MB ideally)
ls -lh *.vsix
```

### Step 4: Test the Packaged Extension

1. **Install the VSIX locally:**
   - Open VS Code
   - Go to Extensions (`Cmd/Ctrl+Shift+X`)
   - Click the `...` menu → `Install from VSIX...`
   - Select your `.vsix` file

2. **Test thoroughly:**
   - Test all commands
   - Test webview panels
   - Test debugging features
   - Test with sample Solidity files

3. **Uninstall test version:**
   - Right-click the extension → Uninstall

### Step 5: Login to Marketplace

```bash
vsce login <your-publisher-name>
```

Example:
```bash
vsce login michojekunle
```

Enter your **Personal Access Token** when prompted.

> 💡 **Tip**: You only need to login once. vsce stores your credentials.

### Step 6: Publish the Extension

**Option 1: Publish current version**
```bash
vsce publish
```

**Option 2: Publish with version bump**
```bash
# Bump patch version: 0.1.0 -> 0.1.1
vsce publish patch

# Bump minor version: 0.1.0 -> 0.2.0
vsce publish minor

# Bump major version: 0.1.0 -> 1.0.0
vsce publish major
```

**Option 3: Publish specific version**
```bash
vsce publish 1.0.0
```

### Step 7: Verify Publication

1. **Check the marketplace:**
   - Visit your extension page: `https://marketplace.visualstudio.com/items?itemName=<publisher>.<extension-name>`
   - Example: `https://marketplace.visualstudio.com/items?itemName=michojekunle.solidity-debugger`

2. **Install from marketplace:**
   - Open VS Code
   - Search for "Solidity Debugger" in Extensions
   - Install and test

3. **Monitor statistics:**
   - Go to [Publisher Management](https://marketplace.visualstudio.com/manage)
   - View install counts, ratings, and reviews

---

## Updating an Existing Extension

### For Minor Updates (Bug Fixes, Small Features)

1. Make your changes
2. Update version:
   ```bash
   vsce publish patch
   ```

### For Major Updates (New Features)

1. Make your changes
2. Update `CHANGELOG.md`
3. Update version:
   ```bash
   vsce publish minor
   ```

### For Breaking Changes

1. Make your changes
2. Update `CHANGELOG.md` with migration guide
3. Update documentation
4. Update version:
   ```bash
   vsce publish major
   ```

---

## Unpublishing an Extension

> ⚠️ **Warning**: Unpublishing is permanent and cannot be undone!

**Unpublish a specific version:**
```bash
vsce unpublish <publisher>.<extension> <version>
```

**Unpublish all versions:**
```bash
vsce unpublish <publisher>.<extension>
```

---

## Common Issues & Solutions

### Issue: "Invalid publisher name"
**Solution**: Ensure the `publisher` field in `package.json` exactly matches your publisher ID on the marketplace.

### Issue: "Extension icon not found"
**Solution**: 
- Ensure `media/icon.png` exists
- Use PNG format, 128x128 pixels recommended
- Update `icon` path in `package.json`

### Issue: "Package too large"
**Solution**:
- Review `.vscodeignore` to exclude unnecessary files
- Run `vsce ls` to see what's included
- Exclude `node_modules`, source files, tests

### Issue: "Command failed with exit code 1"
**Solution**:
- Run `npm run compile` to ensure TypeScript compiles
- Check for TypeScript errors
- Ensure all dependencies are installed

### Issue: "Personal Access Token expired"
**Solution**:
- Create a new PAT in Azure DevOps
- Re-login: `vsce login <publisher>`

---

## Best Practices

1. **Version Control**: Always commit and tag before publishing
2. **Changelog**: Keep detailed changelog for every release
3. **Testing**: Test packaged extension before publishing
4. **Semantic Versioning**: Follow [semver](https://semver.org/) strictly
5. **Documentation**: Keep README up-to-date with every feature
6. **Screenshots**: Add screenshots/GIFs to showcase features
7. **Keywords**: Use relevant keywords for discoverability
8. **Categories**: Choose appropriate categories
9. **Support**: Respond to user issues and reviews
10. **Security**: Never commit PAT tokens to version control

---

## Automated Publishing (CI/CD)

You can automate publishing using GitHub Actions:

```yaml
# .github/workflows/publish.yml
name: Publish Extension

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          npm ci
          cd webview-ui && npm ci
      
      - name: Build
        run: |
          npm run compile
          npm run build:webview
      
      - name: Run tests
        run: npm test
      
      - name: Publish
        run: |
          npm install -g @vscode/vsce
          vsce publish -p ${{ secrets.VSCE_TOKEN }}
        env:
          VSCE_TOKEN: ${{ secrets.VSCE_TOKEN }}
```

Add your PAT as a GitHub secret named `VSCE_TOKEN`.

---

## Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Extension Manifest](https://code.visualstudio.com/api/references/extension-manifest)
- [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)
- [vsce Documentation](https://github.com/microsoft/vscode-vsce)
- [Marketplace Publisher Management](https://marketplace.visualstudio.com/manage)

---

## Quick Reference Commands

```bash
# Install vsce
npm install -g @vscode/vsce

# Package extension
vsce package

# List package contents
vsce ls

# Login to marketplace
vsce login <publisher>

# Publish current version
vsce publish

# Publish with version bump
vsce publish patch|minor|major

# Show extension info
vsce show <publisher>.<extension>

# Unpublish
vsce unpublish <publisher>.<extension> <version>
```

---

**Need Help?** Check the [VS Code Publishing Documentation](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) or open an issue on GitHub.
