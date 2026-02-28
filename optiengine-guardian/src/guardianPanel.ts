import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { ExtensionToWebviewMessage, WebviewToExtensionMessage } from "./types";

export class GuardianPanel implements vscode.WebviewViewProvider {
    public static readonly viewType = "optiengine-guardian.panel";

    private _view?: vscode.WebviewView;
    // Queue messages that arrive before the webview is ready
    private _pendingMessages: ExtensionToWebviewMessage[] = [];
    private _webviewReady: boolean = false;

    constructor(private readonly extensionUri: vscode.Uri) { }

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this._view = webviewView;
        this._webviewReady = false;

        // Configure webview options
        webviewView.webview.options = {
            enableScripts: true,
            // Only allow loading resources from the extension's media folder
            localResourceRoots: [
                vscode.Uri.joinPath(this.extensionUri, "media"),
            ],
        };

        // Set the HTML content
        webviewView.webview.html = this._buildHtml(webviewView.webview);

        // Listen for messages from the webview
        webviewView.webview.onDidReceiveMessage((message: WebviewToExtensionMessage) => {
            switch (message.type) {
                case "WEBVIEW_READY":
                    this._webviewReady = true;
                    // Flush any queued messages
                    for (const pending of this._pendingMessages) {
                        this._view?.webview.postMessage(pending);
                    }
                    this._pendingMessages = [];
                    break;

                case "REQUEST_REFRESH":
                    vscode.commands.executeCommand("optiengine-guardian.refresh");
                    break;

                default:
                    console.warn("[OptiEngine Guardian] Unknown message from webview:", message);
            }
        });

        // When the panel becomes visible again, show loading
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible && this._webviewReady) {
                // Re-trigger the current file analysis when panel reopens
                vscode.commands.executeCommand("optiengine-guardian.refresh");
            }
        });
    }

    /**
     * Called by extension.ts to push state into the webview.
     * If the webview isn't ready yet, messages are queued.
     */
    sendMessage(message: ExtensionToWebviewMessage): void {
        if (!this._view) {
            return;
        }
        if (!this._webviewReady) {
            // Queue it — will flush when WEBVIEW_READY arrives
            this._pendingMessages.push(message);
            return;
        }
        this._view.webview.postMessage(message);
    }

    private _buildHtml(webview: vscode.Webview): string {
        // Load the CSS file as a webview URI so VS Code serves it correctly
        const cssUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, "media", "guardian.css")
        );

        // Content Security Policy:
        // - default-src 'none'     → blocks everything by default
        // - script-src cdn.jsdelivr.net 'unsafe-inline'  → Mermaid CDN + inline init script
        // - style-src 'unsafe-inline' ${webview.cspSource} → inline styles + our CSS
        // - img-src data: blob:    → Mermaid renders diagrams as SVG data URIs
        // - font-src data:         → monospace fonts
        const cspSource = webview.cspSource;
        const csp = [
            `default-src 'none'`,
            `script-src https://cdn.jsdelivr.net 'unsafe-inline'`,
            `style-src 'unsafe-inline' ${cspSource}`,
            `img-src data: blob: ${cspSource}`,
            `font-src data: ${cspSource}`,
        ].join("; ");

        return /* html */`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <title>OptiEngine Guardian</title>
  <link rel="stylesheet" href="${cssUri}" />
</head>
<body>

  <!-- ═══════════════════════════════════════════════ HEADER -->
  <div id="header">
    <span id="header-logo">⬡</span>
    <span id="header-title">OPTIENGINE<br/><span id="header-sub">// GUARDIAN</span></span>
    <button id="refresh-btn" title="Refresh analysis">↺</button>
  </div>

  <!-- ═══════════════════════════════════════════════ ORG BADGE -->
  <div id="org-bar">
    <span id="org-label">ORG</span>
    <span id="org-value">—</span>
    <span id="domain-label">DOMAIN</span>
    <span id="domain-value">—</span>
    <span id="status-dot" class="dot dot--idle"></span>
  </div>

  <!-- ═══════════════════════════════════════════════ MAIN CONTENT -->
  <div id="main">

    <!-- IDLE STATE -->
    <div id="state-idle" class="state active">
      <div class="idle-box">
        <div class="idle-icon">◈</div>
        <div class="idle-text">SAVE A FILE<br/>TO ACTIVATE GUARDIAN</div>
      </div>
    </div>

    <!-- LOADING STATE -->
    <div id="state-loading" class="state">
      <div class="loading-box">
        <div class="spinner">
          <span>▪</span><span>▪</span><span>▪</span>
        </div>
        <div class="loading-text">QUERYING MCP SERVER...</div>
      </div>
    </div>

    <!-- ERROR STATE -->
    <div id="state-error" class="state">
      <div class="error-box">
        <div class="error-icon">✕</div>
        <div class="error-title">MCP SERVER ERROR</div>
        <div id="error-message" class="error-message">—</div>
        <div class="error-hint">Check: optiengine.serverPath in VS Code settings</div>
      </div>
    </div>

    <!-- RENDER STATE (checklist + diagram) -->
    <div id="state-render" class="state">

      <!-- SECTION: CHECKLIST -->
      <div class="section">
        <div class="section-header">
          <span class="section-icon">▣</span>
          <span class="section-title">COMPLIANCE CHECKLIST</span>
          <span id="checklist-count" class="section-count">0</span>
        </div>
        <ul id="checklist-list"></ul>
      </div>

      <!-- SECTION: ARCHITECTURE DIAGRAM -->
      <div class="section">
        <div class="section-header">
          <span class="section-icon">◫</span>
          <span class="section-title">ARCHITECTURE DIAGRAM</span>
        </div>
        <div id="diagram-container">
          <div id="diagram-error" style="display:none;" class="diagram-error">
            ⚠ Diagram render failed
          </div>
          <div id="mermaid-target"></div>
        </div>
      </div>

      <!-- FILE PATH FOOTER -->
      <div id="file-path-bar">
        <span id="file-path-text">—</span>
      </div>

    </div><!-- /state-render -->
  </div><!-- /main -->

  <!-- ═══════════════════════════════════════════════ MERMAID -->
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>

  <!-- ═══════════════════════════════════════════════ WEBVIEW LOGIC -->
  <script>
    // ── Mermaid configuration ──────────────────────────────────────────────
    mermaid.initialize({
      startOnLoad: false,
      theme: "dark",
      themeVariables: {
        background: "#0a0a0a",
        primaryColor: "#1a1a1a",
        primaryTextColor: "#ffffff",
        primaryBorderColor: "#ffffff",
        lineColor: "#ffffff",
        secondaryColor: "#111111",
        tertiaryColor: "#0a0a0a",
        edgeLabelBackground: "#0a0a0a",
        fontSize: "12px",
      },
      flowchart: { curve: "linear", padding: 8 },
    });

    // ── VS Code API ────────────────────────────────────────────────────────
    const vscode = acquireVsCodeApi();

    // ── DOM refs ───────────────────────────────────────────────────────────
    const states = {
      idle:    document.getElementById("state-idle"),
      loading: document.getElementById("state-loading"),
      error:   document.getElementById("state-error"),
      render:  document.getElementById("state-render"),
    };

    const orgValue      = document.getElementById("org-value");
    const domainValue   = document.getElementById("domain-value");
    const statusDot     = document.getElementById("status-dot");
    const errorMessage  = document.getElementById("error-message");
    const checklistList = document.getElementById("checklist-list");
    const checklistCount = document.getElementById("checklist-count");
    const mermaidTarget = document.getElementById("mermaid-target");
    const diagramError  = document.getElementById("diagram-error");
    const filePathText  = document.getElementById("file-path-text");
    const refreshBtn    = document.getElementById("refresh-btn");

    // ── Helpers ────────────────────────────────────────────────────────────
    function showState(name) {
      Object.keys(states).forEach((key) => {
        const el = states[key];
        if (el) el.classList.toggle("active", key === name);
      });
    }

    function setDot(mode) {
      if (!statusDot) return;
      statusDot.className = "dot dot--" + mode;
    }

    async function renderMermaid(diagramStr) {
      if (!mermaidTarget) return;
      mermaidTarget.innerHTML = "";
      if (diagramError) diagramError.style.display = "none";

      if (!diagramStr || diagramStr.trim() === "") {
        mermaidTarget.innerHTML = '<div class="no-diagram">No diagram returned</div>';
        return;
      }

      try {
        // mermaid.render() needs a unique ID each time
        const id = "mermaid-" + Date.now();
        const { svg } = await mermaid.render(id, diagramStr.trim());
        mermaidTarget.innerHTML = svg;
      } catch (err) {
        console.error("[Guardian] Mermaid render error:", err);
        if (diagramError) diagramError.style.display = "block";
        mermaidTarget.innerHTML =
          '<pre class="diagram-raw">' + escapeHtml(diagramStr) + "</pre>";
      }
    }

    function renderChecklist(items) {
      if (!checklistList) return;
      checklistList.innerHTML = "";

      if (!items || items.length === 0) {
        checklistList.innerHTML = '<li class="checklist-empty">No rules retrieved.</li>';
        if (checklistCount) checklistCount.textContent = "0";
        return;
      }

      if (checklistCount) checklistCount.textContent = String(items.length);

      items.forEach((item, idx) => {
        const li = document.createElement("li");
        li.className = "checklist-item";
        li.innerHTML =
          '<span class="item-index">' + String(idx + 1).padStart(2, "0") + '</span>' +
          '<span class="item-text">' + escapeHtml(item) + "</span>" +
          '<span class="item-check">□</span>';
        checklistList.appendChild(li);
      });
    }

    function escapeHtml(str) {
      return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    function shortenPath(p) {
      if (!p) return "—";
      const parts = p.replace(/\\\\/g, "/").split("/");
      return parts.length > 3 ? "…/" + parts.slice(-3).join("/") : p;
    }

    // ── Message handler ────────────────────────────────────────────────────
    window.addEventListener("message", async (event) => {
      const msg = event.data;

      switch (msg.type) {
        case "LOADING":
          showState("loading");
          setDot("loading");
          break;

        case "IDLE":
          showState("idle");
          setDot("idle");
          if (orgValue)    orgValue.textContent    = "—";
          if (domainValue) domainValue.textContent = "—";
          break;

        case "ERROR":
          showState("error");
          setDot("error");
          if (errorMessage) errorMessage.textContent = msg.message || "Unknown error";
          break;

        case "RENDER_CONTEXT": {
          const payload = msg.payload;
          showState("render");
          setDot("ok");

          if (orgValue)    orgValue.textContent    = (payload.org_id    || "—").toUpperCase();
          if (domainValue) domainValue.textContent = (payload.domain    || "—").toUpperCase();
          if (filePathText) filePathText.textContent = shortenPath(payload.file_path);

          renderChecklist(payload.compliance_checklist);
          await renderMermaid(payload.mermaid_diagram);
          break;
        }

        default:
          console.warn("[Guardian] Unhandled message type:", msg.type);
      }
    });

    // ── Refresh button ─────────────────────────────────────────────────────
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        vscode.postMessage({ type: "REQUEST_REFRESH" });
      });
    }

    // ── Signal ready to Extension Host ────────────────────────────────────
    vscode.postMessage({ type: "WEBVIEW_READY" });
  </script>
</body>
</html>`;
    }
}
