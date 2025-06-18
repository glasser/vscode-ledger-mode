import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
    files: 'out/test/suite/**/*.test.js',
    version: 'stable',
    coverage: {
        reporter: ['text', 'html', 'lcov'],
        include: ['out/src/**/*.js'],
        exclude: ['out/test/**/*.js']
    },
    mocha: {
        ui: 'tdd',
        timeout: 20000
    }
});