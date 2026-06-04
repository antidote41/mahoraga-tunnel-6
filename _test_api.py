import urllib.request
import json

r = urllib.request.urlopen("http://127.0.0.1:5000/api/domains")
d = json.loads(r.read())
print(f"Categories: {len(d['grouped'])}")
print(f"Total domains: {len(d['domains'])}")
for k, v in d["grouped"].items():
    print(f"  {k}: {len(v)} modules")

# Test status endpoint
r2 = urllib.request.urlopen("http://127.0.0.1:5000/api/status?log_offset=0&result_offset=0")
s = json.loads(r2.read())
print(f"\nStatus: {s['state']}")
print("API is working!")
