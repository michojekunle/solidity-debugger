import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    globals: true,
    environment: "node", // Changed back to node for fs support
    include: ["src/test/**/*.test.ts"],
    setupFiles: ["./src/test/setup.ts"], // Add setup file for mocks
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "src/test/", "**/*.d.ts", "**/index.ts"],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 65,
        statements: 70,
      },
    },
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "vscode": path.resolve(__dirname, "./src/test/vscode-mock.ts"),
    },
  },
})
