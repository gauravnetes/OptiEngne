import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { McpToolArgs, OrgContext } from "./types";
import * as path from "path";

export class McpClient {
    private client: Client | undefined;
    private transport: StdioClientTransport | undefined;
    private isConnected: boolean = false;

    constructor(
        private readonly serverPath: string,
        private readonly pythonPath: string
    ) { }

    async connect(): Promise<void> {
        if (this.isConnected) { return; }

        // Validate serverPath exists before spawning
        const fs = require("fs") as typeof import("fs");
        if (!fs.existsSync(this.serverPath)) {
            throw new Error(
                `OptiEngine server path does not exist: ${this.serverPath}`
            );
        }

        this.transport = new StdioClientTransport({
            command: this.pythonPath,
            args: ["-m", "app.api.mcp_server"],
            cwd: this.serverPath,
            env: {
                ...process.env,
                PYTHONPATH: this.serverPath,
            },
        });

        this.client = new Client(
            {
                name: "optiengine-guardian-vscode",
                version: "0.1.0",
            },
            {
                capabilities: {},
            }
        );

        // Attach error handler before connecting
        this.transport.onerror = (err: Error) => {
            console.error("[OptiEngine Guardian] Transport error:", err.message);
            this.isConnected = false;
        };

        this.transport.onclose = () => {
            console.warn("[OptiEngine Guardian] MCP transport closed.");
            this.isConnected = false;
        };

        await this.client.connect(this.transport);
        this.isConnected = true;
    }

    async disconnect(): Promise<void> {
        if (!this.isConnected) { return; }
        try {
            await this.client?.close();
        } catch (err) {
            console.warn("[OptiEngine Guardian] Error during disconnect:", err);
        } finally {
            this.isConnected = false;
            this.client = undefined;
            this.transport = undefined;
        }
    }

    async getOrgContext(args: McpToolArgs): Promise<OrgContext> {
        // Auto-reconnect if transport dropped
        if (!this.isConnected || !this.client) {
            console.warn("[OptiEngine Guardian] Not connected — attempting reconnect...");
            await this.connect();
        }

        if (!this.client) {
            throw new Error("MCP client failed to initialize.");
        }

        // Truncate content to avoid overwhelming the MCP server
        // Most servers have a context limit — 8000 chars is safe
        const truncatedContent =
            args.content.length > 8000
                ? args.content.slice(0, 8000) + "\n... [truncated]"
                : args.content;

        let rawResult: unknown;

        try {
            rawResult = await this.client.callTool({
                name: "get_org_context",
                arguments: {
                    file_path: args.file_path,
                    content: truncatedContent,
                    org_id: args.org_id,
                },
            });
        } catch (err) {
            // If the call fails, mark as disconnected so next call retries
            this.isConnected = false;
            const message = err instanceof Error ? err.message : String(err);
            throw new Error(`MCP tool call failed: ${message}`);
        }

        return this.parseOrgContext(rawResult, args);
    }

    /**
     * The MCP SDK returns tool results as { content: Array<{ type: string, text: string }> }
     * We need to extract the JSON from the text field and validate it.
     */
    private parseOrgContext(raw: unknown, args: McpToolArgs): OrgContext {
        // Case 1: SDK wraps result in { content: [{ type: "text", text: "..." }] }
        if (
            raw &&
            typeof raw === "object" &&
            "content" in raw &&
            Array.isArray((raw as { content: unknown[] }).content)
        ) {
            const content = (raw as { content: Array<{ type: string; text: string }> }).content;
            const textBlock = content.find((c) => c.type === "text");
            if (textBlock?.text) {
                return this.parseJsonString(textBlock.text, args);
            }
        }

        // Case 2: Result is already a plain object (some MCP server implementations)
        if (raw && typeof raw === "object" && "compliance_checklist" in raw) {
            return this.validateOrgContext(raw as Record<string, unknown>, args);
        }

        // Case 3: Result is a raw JSON string
        if (typeof raw === "string") {
            return this.parseJsonString(raw, args);
        }

        throw new Error(
            "MCP server returned an unrecognized response shape. " +
            "Expected { content: [{ type: 'text', text: '{...}' }] }"
        );
    }

    private parseJsonString(text: string, args: McpToolArgs): OrgContext {
        let parsed: unknown;
        try {
            // Strip markdown code fences if the server wrapped JSON in ```json ... ```
            const cleaned = text
                .replace(/^```json\s*/i, "")
                .replace(/^```\s*/i, "")
                .replace(/```\s*$/i, "")
                .trim();
            parsed = JSON.parse(cleaned);
        } catch {
            throw new Error(
                `MCP server returned invalid JSON: ${text.slice(0, 200)}`
            );
        }
        return this.validateOrgContext(parsed as Record<string, unknown>, args);
    }

    private validateOrgContext(
        obj: Record<string, unknown>,
        args: McpToolArgs
    ): OrgContext {
        // compliance_checklist: must be an array of strings
        const checklist = obj["compliance_checklist"];
        if (!Array.isArray(checklist)) {
            throw new Error(
                "MCP response missing required field: compliance_checklist (expected string[])"
            );
        }

        // mermaid_diagram: must be a string (can be empty)
        const diagram = obj["mermaid_diagram"];
        if (typeof diagram !== "string") {
            throw new Error(
                "MCP response missing required field: mermaid_diagram (expected string)"
            );
        }

        return {
            compliance_checklist: checklist.filter((item) => typeof item === "string"),
            mermaid_diagram: diagram,
            org_id: typeof obj["org_id"] === "string" ? obj["org_id"] : args.org_id,
            domain: typeof obj["domain"] === "string" ? obj["domain"] : "Global",
            file_path: typeof obj["file_path"] === "string" ? obj["file_path"] : args.file_path,
        };
    }

    get connected(): boolean {
        return this.isConnected;
    }
}
