import {existsSync} from "node:fs";
import {defineConfig} from "vitest/config";

if(existsSync(".env.test")){
    process.loadEnvFile(".env.test");
}

export default defineConfig({
    test: {
        include: ["tests/**/*.test.ts"],
        setupFiles: ["tests/setup.ts"],

        fileParallelism: false,
    },

    
});