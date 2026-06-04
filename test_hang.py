import requests
import time
import threading

def poll_status():
    for _ in range(20):
        try:
            start_t = time.time()
            r = requests.get("http://127.0.0.1:8080/api/status?log_offset=0&result_offset=0", timeout=5)
            elapsed = time.time() - start_t
            print(f"Poll returned {r.status_code} in {elapsed:.3f}s")
        except Exception as e:
            print(f"Poll error: {e}")
        time.sleep(0.5)

print("Starting background server...")
import subprocess
server = subprocess.Popen(["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "1", "--threads", "16", "app:app"])
time.sleep(2) # wait for boot

print("Sending start...")
try:
    r = requests.post("http://127.0.0.1:8080/api/start", json={
        "emails": ["test@example.com", "test2@example.com", "test3@example.com"],
        "domains": ["twitter", "instagram"],
        "thread_size": 2,
        "proxy": {"mode": "none"}
    })
    print("Start response:", r.status_code, r.text)

    poll_status()
finally:
    server.terminate()
