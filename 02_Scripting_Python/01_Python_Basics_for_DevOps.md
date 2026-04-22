# 🐍 Python Scripting for DevOps

### 🎯 For Beginners — Why DevOps Engineers need Python

______________________________________________________________________

## 📌 1️⃣ Why Learn Python for DevOps?

> 💡 **Think of it like this:**\
> Bash is great for quick commands.\
> Python is great when logic gets complex, you need to talk to APIs, or handle JSON data.

**Common DevOps Python Tasks:**

- Automate boring tasks (cleaning up old files)
- Talk to Cloud APIs (e.g., list all stopped AWS/Azure instances)
- Parse JSON from tools (like Docker or Kubernetes output)
- Write custom CI/CD scripts

______________________________________________________________________

## 📌 2️⃣ Core Concepts (Fast Track)

### 🔹 Variables & Data Types

```python
server_name = "web-01"       # String
cpu_cores = 4                # Integer
is_running = True            # Boolean
servers = ["web-01", "db-01"] # List (Array)
config = {"port": 80}        # Dictionary (Key-Value)
```

### 🔹 Loops (Doing things multiple times)

```python
servers = ["web-01", "web-02", "db-01"]

for server in servers:
    print(f"Starting server: {server}")
```

### 🔹 If/Else Statements (Logic)

```python
cpu_usage = 85

if cpu_usage > 80:
    print("ALERT: High CPU!")
else:
    print("CPU is normal.")
```

______________________________________________________________________

## 📌 3️⃣ Real-World DevOps Scripts

### 🔹 Scenario 1: Running Shell Commands inside Python

*Sometimes you need to run regular Linux commands inside your Python script.*

```python
import subprocess

# Run 'df -h' to check disk space
result = subprocess.run(["df", "-h"], capture_output=True, text=True)

print("Disk Space Report:")
print(result.stdout)
```

### 🔹 Scenario 2: Working with JSON

*DevOps is 90% dealing with JSON. Let's read a config.*

```python
import json

# Imagine this JSON came from an API
json_data = '{"server": "ubuntu", "status": "running", "uptime_days": 45}'

# Convert JSON string to Python Dictionary
data = json.loads(json_data)

print(f"The {data['server']} server is currently {data['status']}.")
if data['uptime_days'] > 30:
    print("Consider patching and rebooting soon.")
```

### 🔹 Scenario 3: Checking if a Website is UP

*Using the `requests` library to monitor a site.*

```python
import requests

url = "https://github.com"

try:
    response = requests.get(url)
    if response.status_code == 200:
        print(f"✅ {url} is UP!")
    else:
        print(f"⚠️ {url} returned status: {response.status_code}")
except requests.ConnectionError:
    print(f"❌ Failed to connect to {url}!")
```

______________________________________________________________________

## 🧠 Summary

1. **Python** > Bash for complex logic and APIs.
1. Use **`subprocess`** to run Linux commands.
1. Use **`json`** to parse data from tools.
1. Use **`requests`** to talk to APIs or check websites.

## ✅ Quick Quiz

1. You need to write a script to check if 50 URLs are returning HTTP 200. What Python library do you use?
   > **Answer**: The `requests` library. 🌐
1. You want to run a simple `ls -l` command from Python. What module do you import?
   > **Answer**: `import subprocess` 🖥️

______________________________________________________________________

> [!TIP]
> **Pro Tip:** Practice these commands in a lab environment to build muscle memory!
