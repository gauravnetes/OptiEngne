import sys
import os
import time
import json

sys.path.insert(0, os.getcwd())
from app.api.mcp_server import get_org_context

print("Testing instant loading response...")
t0 = time.time()
res1 = get_org_context(
    file_path="test.js",
    content="const x = 1;",
    org_id="global"
)
print(f"Call 1 finished in {time.time()-t0:.3f}s")
obj1 = json.loads(res1)
print(f"Checklist 1: {obj1['compliance_checklist'][0]}")

print("\nWaiting for background thread to load model (~50s)...")
for i in range(12):
    time.sleep(5)
    print(f"... {i*5 + 5}s")

print("\nTesting parsed response...")
t0 = time.time()
res2 = get_org_context(
    file_path="test.js",
    content="const x = 1;",
    org_id="global"
)
print(f"Call 2 finished in {time.time()-t0:.3f}s")
obj2 = json.loads(res2)
print(f"Checklist 2: {obj2['compliance_checklist'][0]}")
