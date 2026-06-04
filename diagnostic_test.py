import sys
import time
import urllib.request
import urllib.error
import json

def print_header(title):
    print(f"\n{'='*50}\n{title}\n{'='*50}")

def check_ip():
    print_header("1. Checking Public IP & ASN Info")
    try:
        req = urllib.request.Request("https://ipinfo.io/json", headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode())
            print(f"IP Address  : {data.get('ip')}")
            print(f"Organization: {data.get('org')}")
            print(f"Location    : {data.get('city')}, {data.get('country')}")
            
            if "GitHub" in data.get('org', '') or "Microsoft" in data.get('org', '') or "Azure" in data.get('org', ''):
                print("\n[!] WARNING: You are running on a known Datacenter IP (Microsoft/GitHub).")
                print("    Many targets will actively block requests from this IP range.")
    except Exception as e:
        print(f"Failed to fetch IP info: {e}")

def check_outbound(url):
    print(f"\nTesting connection to: {url}")
    try:
        # We use a standard browser User-Agent to simulate what holehe might do
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'})
        start_time = time.time()
        with urllib.request.urlopen(req, timeout=10) as response:
            elapsed = time.time() - start_time
            print(f"  [SUCCESS] Status Code: {response.getcode()}")
            print(f"  [SUCCESS] Response Time: {elapsed:.2f} seconds")
    except urllib.error.HTTPError as e:
        print(f"  [BLOCKED/ERROR] Status Code: {e.code} ({e.reason})")
        # Check if the site is serving a CAPTCHA or blocking page
        try:
            body = e.read().decode('utf-8', errors='ignore')
            body_lower = body.lower()
            if "captcha" in body_lower or "challenge" in body_lower or "datadome" in body_lower or "cloudflare" in body_lower:
                print("  [!] WARNING: Anti-bot protection (CAPTCHA/Challenge) detected in the response body!")
        except:
            pass
    except urllib.error.URLError as e:
        print(f"  [FAILED] Connection error: {e.reason}")
    except Exception as e:
        print(f"  [FAILED] Error: {e}")

def test_targets():
    print_header("2. Testing Target Connectivity (Simulating holehe)")
    targets = [
        "https://www.instagram.com/accounts/login/",
        "https://twitter.com/i/flow/login",
        "https://www.spotify.com/us/login/",
        "https://imgur.com/signin",
        "https://github.com/login"
    ]
    for t in targets:
        check_outbound(t)

if __name__ == "__main__":
    print_header("DIAGNOSTIC TEST STARTING")
    print(f"Python Version: {sys.version}")
    check_ip()
    test_targets()
    print("\n" + "="*50)
    print("Diagnostic complete. Please copy these logs and paste them in the chat.")
    print("="*50 + "\n")
