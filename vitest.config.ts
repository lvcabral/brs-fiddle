import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "jsdom",
        include: ["test/**/*.test.ts"],
        setupFiles: ["./test/setup.ts"],
        clearMocks: true,
        coverage: {
            provider: "v8",
            reporter: ["text", "html"],
            include: ["src/snippets.ts", "src/util.ts", "src/template-list.ts"],
        },
    },
});
