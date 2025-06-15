// Helper to ensure extension is activated for tests
const vscode = require('vscode');

async function activateExtension() {
    try {
        const extension = vscode.extensions.getExtension('ledger.vscode-ledger');
        if (extension && !extension.isActive) {
            await extension.activate();
        }
        return extension;
    } catch (error) {
        console.log('Extension activation failed in test environment:', error);
        return null;
    }
}

module.exports = { activateExtension };