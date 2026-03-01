const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");

const pythonPath = "..\\backend\\venv\\Scripts\\python.exe";
const serverPath = "..\\backend";

const transport = new StdioClientTransport({
    command: pythonPath,
    args: ["-m", "app.api.mcp_server"],
    cwd: serverPath,
    env: { ...process.env, PYTHONPATH: serverPath }
});

const client = new Client(
    { name: "test", version: "1" },
    { capabilities: {} }
);

transport.onerror = (err) => console.error("Transport ERROR:", err);
transport.onclose = () => console.warn("Transport CLOSED");

async function run() {
    console.log("Connecting...");
    await client.connect(transport);
    console.log("Connected.");

    console.log("Simulating Save 1...");
    client.callTool({
        name: "get_org_context",
        arguments: { file_path: "1.js", content: "const a = 1;", org_id: "global" }
    }, undefined, { timeout: 120000 }).then(res => console.log("Save 1 SUCCESS")).catch(err => console.log("Save 1 ERR:", err.message));

    // Simulate clicking save 300ms later (debounce fires)
    await new Promise(r => setTimeout(r, 600));

    console.log("Simulating Save 2...");
    client.callTool({
        name: "get_org_context",
        arguments: { file_path: "2.js", content: "const b = 2;", org_id: "global" }
    }, undefined, { timeout: 120000 }).then(res => console.log("Save 2 SUCCESS")).catch(err => console.log("Save 2 ERR:", err.message));

    // Rapid save 3
    console.log("Simulating Save 3 (Immediate)...");
    client.callTool({
        name: "get_org_context",
        arguments: { file_path: "3.js", content: "const c = 3;", org_id: "global" }
    }, undefined, { timeout: 120000 }).then(res => { console.log("Save 3 SUCCESS"); client.close(); }).catch(err => console.log("Save 3 ERR:", err.message));
}
run();
