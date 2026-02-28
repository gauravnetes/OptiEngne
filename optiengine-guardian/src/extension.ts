import * as vscode from "vscode";
import { GuardianPanel } from "./guardianPanel";
import { McpClient } from "./mcpClient";

let mcpClient: McpClient | undefined;
let guardianPanel: GuardianPanel | undefined;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

export async function activate(context: vscode.ExtensionContext) {
    console.log("[OptiEngine Guardian] Activating...");

    // 1. Register the WebView Sidebar Provider
    guardianPanel = new GuardianPanel(context.extensionUri);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            "optiengine-guardian.panel",
            guardianPanel,
            { webviewOptions: { retainContextWhenHidden: true } }
        )
    );

    // 2. Initialize MCP Client
    const config = vscode.workspace.getConfiguration("optiengine");
    const serverPath = config.get<string>("serverPath", "");

    if (!serverPath) {
        vscode.window.showWarningMessage(
            "OptiEngine Guardian: Set optiengine.serverPath in VS Code settings to enable MCP."
        );
    } else {
        mcpClient = new McpClient(
            serverPath,
            config.get<string>("pythonPath", "python3")
        );
        await initializeMcpClient();
    }

    // 3. Register Commands
    context.subscriptions.push(
        vscode.commands.registerCommand("optiengine-guardian.refresh", async () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                await triggerAnalysis(editor.document);
            }
        }),

        vscode.commands.registerCommand("optiengine-guardian.clearPanel", () => {
            guardianPanel?.sendMessage({ type: "IDLE" });
        })
    );

    // 4. Event Listeners
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(async (document) => {
            clearDebounce();
            const debounceMs = vscode.workspace
                .getConfiguration("optiengine")
                .get<number>("debounceMs", 1500);
            debounceTimer = setTimeout(async () => {
                await triggerAnalysis(document);
            }, debounceMs);
        }),

        vscode.window.onDidChangeActiveTextEditor(async (editor) => {
            if (!editor) {
                guardianPanel?.sendMessage({ type: "IDLE" });
                return;
            }
            guardianPanel?.sendMessage({ type: "LOADING" });
        }),

        vscode.workspace.onDidChangeConfiguration(async (e) => {
            if (e.affectsConfiguration("optiengine")) {
                await reinitializeMcpClient();
            }
        })
    );

    console.log("[OptiEngine Guardian] Active.");
}

async function triggerAnalysis(document: vscode.TextDocument) {
    if (!mcpClient || !guardianPanel) { return; }

    const supportedLanguages = [
        "typescript", "javascript", "python", "go", "java",
        "csharp", "rust", "cpp", "c", "typescriptreact", "javascriptreact"
    ];

    if (!supportedLanguages.includes(document.languageId)) { return; }

    guardianPanel.sendMessage({ type: "LOADING" });

    const filePath = document.uri.fsPath;
    const content = document.getText();
    const orgId = resolveOrgId(filePath);

    try {
        const result = await mcpClient.getOrgContext({
            file_path: filePath,
            content: content,
            org_id: orgId,
        });
        guardianPanel.sendMessage({ type: "RENDER_CONTEXT", payload: result });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown MCP error";
        console.error("[OptiEngine Guardian] MCP error:", message);
        guardianPanel.sendMessage({ type: "ERROR", message });
    }
}

function resolveOrgId(filePath: string): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders?.length) { return "global"; }

    const wsRoot = workspaceFolders[0].uri.fsPath;
    try {
        const fs = require("fs") as typeof import("fs");
        const configPath = `${wsRoot}/optiengine.config.json`;
        if (fs.existsSync(configPath)) {
            const cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
            if (cfg.org_id) { return cfg.org_id as string; }
        }
    } catch { /* fall through */ }

    const folderName = workspaceFolders[0].name.toLowerCase();
    const knownOrgs = ["novapay", "medicore"];
    return knownOrgs.find((o) => folderName.includes(o)) ?? "global";
}

async function initializeMcpClient() {
    if (!mcpClient) { return; }
    try {
        await mcpClient.connect();
        console.log("[OptiEngine Guardian] MCP connected.");
        vscode.window.setStatusBarMessage("$(shield) OptiEngine: Connected", 3000);
    } catch (err) {
        console.error("[OptiEngine Guardian] MCP connect failed:", err);
        vscode.window.showErrorMessage(
            "OptiEngine Guardian: Could not connect to MCP server. Check optiengine.serverPath."
        );
    }
}

async function reinitializeMcpClient() {
    if (mcpClient) {
        await mcpClient.disconnect();
        mcpClient = undefined;
    }
    const config = vscode.workspace.getConfiguration("optiengine");
    const serverPath = config.get<string>("serverPath", "");
    if (serverPath) {
        mcpClient = new McpClient(
            serverPath,
            config.get<string>("pythonPath", "python3")
        );
        await initializeMcpClient();
    }
}

function clearDebounce() {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = undefined;
    }
}

export async function deactivate() {
    clearDebounce();
    if (mcpClient) { await mcpClient.disconnect(); }
}
