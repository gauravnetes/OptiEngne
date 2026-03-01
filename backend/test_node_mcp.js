const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");

const pythonPath = ".\\venv\\Scripts\\python.exe";
const serverPath = ".";

console.log("Creating transport...");
const transport = new StdioClientTransport({
    command: pythonPath,
    args: ["-m", "app.api.mcp_server"],
    cwd: serverPath,
    env: { ...process.env, PYTHONPATH: serverPath }
});

const client = new Client(
    { name: "test-client", version: "1.0.0" },
    { capabilities: {} }
);

transport.onerror = (err) => console.error("Transport error:", err);
transport.onclose = () => console.warn("Transport closed");

async function run() {
    console.log("Connecting (this should take ~50s for model load)...");
    const t0 = Date.now();
    await client.connect(transport);
    console.log(`Connected in ${(Date.now() - t0) / 1000}s`);

    console.log("Calling tool...");
    const t1 = Date.now();
    const result = await client.callTool(
        {
            name: "get_org_context",
            arguments: {
                file_path: "test.ts",
                content: "const x = 1;",
                org_id: "global"
            }
        },
        undefined,
        { timeout: 120000 }
    );
    console.log(`Tool call done in ${(Date.now() - t1) / 1000}s`);
    console.log("Rules:", JSON.parse(result.content[0].text).compliance_checklist.length);

    await client.close();
}

run().catch(err => console.error("Fatal:", err));
