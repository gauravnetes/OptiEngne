import * as vscode from "vscode";
import { ExtensionToWebviewMessage, WebviewToExtensionMessage } from "./types";

export class GuardianPanel implements vscode.WebviewViewProvider {
  public static readonly viewType = "optiengine-guardian.panel";

  private _view?: vscode.WebviewView;
  private _pendingMessages: ExtensionToWebviewMessage[] = [];
  private _webviewReady: boolean = false;
  private _lastMessage: ExtensionToWebviewMessage | undefined;

  constructor(private readonly extensionUri: vscode.Uri) { }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;
    this._webviewReady = false;

    // 1. Configure webview options
    webviewView.webview.options = {
      enableScripts: true
    };

    // 2. Assign HTML EXACTLY ONCE to prevent the Service Worker InvalidStateError
    webviewView.webview.html = this._buildHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((message: WebviewToExtensionMessage) => {
      switch (message.type) {
        case "WEBVIEW_READY":
          this._webviewReady = true;
          for (const pending of this._pendingMessages) {
            this._view?.webview.postMessage(pending);
          }
          this._pendingMessages = [];
          if (this._lastMessage && this._view) {
            this._view.webview.postMessage(this._lastMessage);
          }
          break;
        case "REQUEST_REFRESH":
          vscode.commands.executeCommand("optiengine-guardian.refresh");
          break;
      }
    });

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible && this._webviewReady) {
        if (this._lastMessage) {
          webviewView.webview.postMessage(this._lastMessage);
        }
        vscode.commands.executeCommand("optiengine-guardian.refresh");
      }
    });
  }

  sendMessage(message: ExtensionToWebviewMessage): void {
    if (message.type === "RENDER_CONTEXT" || message.type === "ERROR" || message.type === "IDLE") {
      this._lastMessage = message;
    }
    if (!this._view) return;
    if (!this._webviewReady) {
      this._pendingMessages.push(message);
      return;
    }
    this._view.webview.postMessage(message);
  }

  private _buildHtml(webview: vscode.Webview): string {
    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "guardian.css"));
    const cspSource = webview.cspSource;
    const csp = [
      `default-src 'none'`,
      `script-src https://cdn.jsdelivr.net 'unsafe-inline'`,
      `style-src 'unsafe-inline' ${cspSource}`,
      `img-src data: blob: ${cspSource}`,
      `font-src data: ${cspSource}`,
    ].join("; ");

    return `
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
  <div id="header">
    <span id="header-logo">⬡</span>
    <span id="header-title">OPTIENGINE<br/><span id="header-sub">// GUARDIAN</span></span>
    <button id="refresh-btn" title="Refresh analysis">↺</button>
  </div>
  <div id="org-bar">
    <span id="org-label">ORG</span><span id="org-value">—</span>
    <span id="domain-label">DOMAIN</span><span id="domain-value">—</span>
    <span id="status-dot" class="dot dot--idle"></span>
  </div>
  <div id="main">
    <div id="state-idle" class="state active">
      <div class="idle-box"><div class="idle-icon">◈</div><div class="idle-text">SAVE A FILE<br/>TO ACTIVATE GUARDIAN</div></div>
    </div>
    <div id="state-loading" class="state">
      <div class="loading-box">
        <div class="spinner"><span>▪</span><span>▪</span><span>▪</span></div>
        <div class="loading-text">QUERYING MCP SERVER...</div>
      </div>
    </div>
    <div id="state-error" class="state">
      <div class="error-box">
        <div class="error-icon">✕</div>
        <div class="error-title">MCP SERVER ERROR</div>
        <div id="error-message" class="error-message">—</div>
        <div class="error-hint">Check: optiengine.serverPath in VS Code settings</div>
      </div>
    </div>
    <div id="state-render" class="state">
      <div class="section">
        <div class="section-header">
          <span class="section-icon">▣</span><span class="section-title">COMPLIANCE CHECKLIST</span>
          <span id="checklist-count" class="section-count">0</span>
        </div>
        <ul id="checklist-list"></ul>
      </div>
      <div class="section">
        <div class="section-header">
          <span class="section-icon">◫</span>
          <span class="section-title">ARCHITECTURE DIAGRAM</span>
          <button id="download-svg-btn" class="section-action" title="Download as SVG">DOWNLOAD SVG</button>
        </div>
        <div id="diagram-container">
          <div id="diagram-error" style="display:none;" class="diagram-error">⚠ Diagram render failed</div>
          <div id="mermaid-target"></div>
        </div>
      </div>
      <div id="file-path-bar"><span id="file-path-text">—</span></div>
    </div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <script>
    mermaid.initialize({
      startOnLoad: false, theme: "dark",
      themeVariables: {
        background: "#0a0a0a", primaryColor: "#1a1a1a", primaryTextColor: "#ffffff",
        primaryBorderColor: "#ffffff", lineColor: "#ffffff", secondaryColor: "#111111",
        tertiaryColor: "#0a0a0a", edgeLabelBackground: "#0a0a0a", fontSize: "12px",
      }, flowchart: { curve: "linear", padding: 8 },
    });
    const vscode = acquireVsCodeApi();
    const states = {
      idle: document.getElementById("state-idle"), loading: document.getElementById("state-loading"),
      error: document.getElementById("state-error"), render: document.getElementById("state-render"),
    };
    function showState(name) {
      Object.keys(states).forEach((key) => {
        const el = states[key];
        if (el) el.classList.toggle("active", key === name);
      });
    }

    // ── SVG Download Logic
    document.getElementById("download-svg-btn")?.addEventListener("click", () => {
      const svgNode = document.querySelector("#mermaid-target svg");
      if (!svgNode) return;
      
      // Clone so we don't modify the visible DOM
      const clone = svgNode.cloneNode(true);
      // Give it a transparent background for maximum utility (or hardcode brutalist #0a0a0a)
      clone.style.backgroundColor = "#0a0a0a"; 
      
      const svgData = new XMLSerializer().serializeToString(clone);
      const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = url;
      link.download = "optiengine-architecture.svg";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
    async function renderMermaid(diagramStr) {
      const target = document.getElementById("mermaid-target");
      const err = document.getElementById("diagram-error");
      if (!target) return;
      target.innerHTML = "";
      if (!diagramStr || !diagramStr.trim()) {
        target.innerHTML = '<div class="no-diagram">No diagram returned</div>';
        return;
      }
      try {
        const { svg } = await mermaid.render("mermaid-" + Date.now(), diagramStr.trim());
        target.innerHTML = svg;
      } catch (e) {
        if (err) err.style.display = "block";
        target.innerHTML = '<pre class="diagram-raw">' + diagramStr.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</pre>";
      }
    }
    function renderChecklist(items) {
      const list = document.getElementById("checklist-list");
      const count = document.getElementById("checklist-count");
      if (!list) return;
      list.innerHTML = "";
      if (!items || items.length === 0) {
        list.innerHTML = '<li class="checklist-empty">No rules retrieved.</li>';
        if (count) count.textContent = "0";
        return;
      }
      if (count) count.textContent = String(items.length);
      items.forEach((item, idx) => {
        const li = document.createElement("li");
        li.className = "checklist-item";
        
        const badgeMatch = item.match(/^\\[([^\\]]+)\\]/);
        const metaMatch = item.match(/\\((\\d+)% relevance \\| ([^)]+)\\)/);
        let ruleText = item;
        let badgeHtml = "";
        let metaHtml = "";

        if (badgeMatch) {
          const topic = badgeMatch[1];
          ruleText = ruleText.replace(badgeMatch[0], "").trim();
          let badgeClass = "badge-rule";
          if (topic.toLowerCase() === "error") badgeClass = "badge-error";
          badgeHtml = '<span class="item-badge ' + badgeClass + '">' + topic + "</span>";
        }
        if (metaMatch) {
          metaHtml = '<span class="item-meta"><span class="meta-relevance">' + metaMatch[1] + '%</span><span class="meta-domain">' + metaMatch[2] + '</span></span>';
          ruleText = ruleText.replace(metaMatch[0], "").trim();
          if (ruleText.startsWith("—")) ruleText = ruleText.substring(1).trim();
        }

        li.innerHTML = '<span class="item-index">' + String(idx + 1).padStart(2, "0") + "</span>" +
          '<div class="item-content">' + (badgeHtml ? '<div class="item-header">' + badgeHtml + metaHtml + "</div>" : "") +
          '<span class="item-text">' + ruleText.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</span></div>" +
          '<span class="item-check">□</span>';
        list.appendChild(li);
      });
    }
    window.addEventListener("message", async (event) => {
      const msg = event.data;
      if (msg.type === "LOADING") {
        showState("loading");
        document.getElementById("status-dot").className = "dot dot--loading";
      } else if (msg.type === "IDLE") {
        showState("idle");
        document.getElementById("status-dot").className = "dot dot--idle";
        document.getElementById("org-value").textContent = "—";
        document.getElementById("domain-value").textContent = "—";
      } else if (msg.type === "ERROR") {
        showState("error");
        document.getElementById("status-dot").className = "dot dot--error";
        document.getElementById("error-message").textContent = msg.message || "Unknown error";
      } else if (msg.type === "RENDER_CONTEXT") {
        showState("render");
        document.getElementById("status-dot").className = "dot dot--ok";
        document.getElementById("org-value").textContent = (msg.payload.org_id || "—").toUpperCase();
        document.getElementById("domain-value").textContent = (msg.payload.domain || "—").toUpperCase();
        let p = msg.payload.file_path;
        document.getElementById("file-path-text").textContent = p ? (p.split(/[\\\\/]/).length > 3 ? "…/" + p.split(/[\\\\/]/).slice(-3).join("/") : p) : "—";
        renderChecklist(msg.payload.compliance_checklist);
        await renderMermaid(msg.payload.mermaid_diagram);
      }
    });
    document.getElementById("refresh-btn")?.addEventListener("click", () => vscode.postMessage({ type: "REQUEST_REFRESH" }));
    vscode.postMessage({ type: "WEBVIEW_READY" });
  </script>
</body>
</html>`;
  }
}
