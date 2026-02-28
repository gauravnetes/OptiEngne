export interface OrgContext {
    compliance_checklist: string[];
    mermaid_diagram: string;
    org_id: string;
    domain: string;
    file_path: string;
}

export interface McpToolArgs {
    file_path: string;
    content: string;
    org_id: string;
}

export type ExtensionToWebviewMessage =
    | { type: "RENDER_CONTEXT"; payload: OrgContext }
    | { type: "LOADING" }
    | { type: "ERROR"; message: string }
    | { type: "IDLE" };

export type WebviewToExtensionMessage =
    | { type: "WEBVIEW_READY" }
    | { type: "REQUEST_REFRESH" };
