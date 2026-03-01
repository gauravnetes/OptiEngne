import * as vscode from "vscode";
import { GuardianPanel } from "./guardianPanel";
import { McpClient } from "./mcpClient";

let mcpClient: McpClient | undefined;
let guardianPanel: GuardianPanel | undefined;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log("[OptiEngine Guardian] Activating extension...");

    // 1. Register Webview Provider IMMEDIATELY
    guardianPanel = new GuardianPanel(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            GuardianPanel.viewType,
            guardianPanel,
            { webviewOptions: { retainContextWhenHidden: true } }
        )
    );

    // 2. Initialize MCP ASYNCHRONOUSLY to prevent 10s activation timeout
    const config = vscode.workspace.getConfiguration("optiengine");
    const serverPath = config.get<string>("serverPath", "");

    if (serverPath) {
        mcpClient = new McpClient(serverPath, config.get<string>("pythonPath", "python3"));
        mcpClient.connect().then(() => {
            console.log("[OptiEngine Guardian] MCP connect promise resolved.");
            vscode.window.setStatusBarMessage("$(shield) OptiEngine", 3000);
        }).catch(err => {
            console.error("[OptiEngine Guardian] MCP connect failed:", err);
        });
    }

    // 3. Register Commands
    context.subscriptions.push(
        vscode.commands.registerCommand("optiengine-guardian.refresh", () => {
            if (vscode.window.activeTextEditor) {
                triggerAnalysis(vscode.window.activeTextEditor.document);
            }
        }),
        vscode.workspace.onDidSaveTextDocument(doc => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => triggerAnalysis(doc), 1500);
        }),
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (!editor) guardianPanel?.sendMessage({ type: "IDLE" });
            else guardianPanel?.sendMessage({ type: "LOADING" });
        })
    );

    console.log("[OptiEngine Guardian] Activation complete. Awaiting user actions.");
}

async function triggerAnalysis(document: vscode.TextDocument) {
    if (!mcpClient || !guardianPanel) return;

    // Ignore unsupported files
    const supported = ["typescript", "javascript", "python", "go", "java", "csharp", "rust", "cpp", "c", "typescriptreact", "javascriptreact"];
    if (!supported.includes(document.languageId)) return;

    guardianPanel.sendMessage({ type: "LOADING" });

    try {
        console.log(`[OptiEngine Guardian] Sending tool call for ${document.uri.fsPath}`);
        const result = await mcpClient.getOrgContext({
            file_path: document.uri.fsPath,
            content: document.getText(),
            org_id: getWorkspaceOrg()
        });
        guardianPanel.sendMessage({ type: "RENDER_CONTEXT", payload: result });
    } catch (err) {
        console.error("[OptiEngine Guardian] Tool call error:", err);
        guardianPanel.sendMessage({ type: "ERROR", message: err instanceof Error ? err.message : String(err) });
    }
}

function getWorkspaceOrg(): string {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) return "global";
    const name = folders[0].name.toLowerCase();
    if (name.includes("novapay")) return "novapay";
    if (name.includes("medicore")) return "medicore";
    return "global";
}

export function deactivate() {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (mcpClient) mcpClient.disconnect();
}
