# 📊 Monitoring & Logging
### 🎯 For Beginners — Prometheus, Grafana & ELK

---

## 1️⃣ What is Monitoring & Why Do We Need It?

> 💡 **Think of it like the dashboard of your car.**  
> Without a dashboard, you don't know your speed, or if your engine is overheating.  
> Without monitoring, you don't know if your server's CPU is at 100% or if your app is crashing!

### The Two Pillars:
1. **Metrics (Numbers)**: "CPU is at 95%", "Memory is 8GB", "500 requests per second".  
   → Best tool: **Prometheus + Grafana**
2. **Logs (Text)**: "User login failed at 10:05", "Database connection error".  
   → Best tool: **ELK Stack (Elasticsearch, Logstash, Kibana)** or **Azure Log Analytics**

---

## 2️⃣ Prometheus & Grafana (The Metrics Duo)

### How They Work Together:
```
[Your Web Server]
       ↓ (runs a tiny program called Node Exporter)
[Node Exporter] ← exposes CPU/RAM stats on a web port
       ↑
[Prometheus] ← reaches out every 15s and "scrapes" the data
       ↓ (stores data in database)
[Grafana] ← draws beautiful graphs using Prometheus data
```

### Key Terms:
- **Scraping**: Prometheus actively reaches out to your servers to pull data (Pull model).
- **Exporters**: Tiny programs you install on servers to translate stats into a format Prometheus understands. (e.g., `node_exporter` for Linux stats).
- **Alertmanager**: Triggers an alert (Slack, Email) if a metric crosses a line (e.g., CPU > 90%).

---

## 3️⃣ The ELK Stack (The Log Masters)

### How It Works:
```
[Your Web Server logs (app.log)]
       ↓
[Logstash / Filebeat] ← reads the log files and sends them
       ↓
[Elasticsearch] ← a massive search engine database for logs
       ↓
[Kibana] ← the UI where you search "error" and see results
```

### Why ELK?
If you have 50 microservices, you cannot SSH into 50 servers to read log files. ELK centralizes **ALL** logs into one searchable website.

---

## 4️⃣ Real-World DevOps Scenarios

### Scenario 1: Black Friday Traffic Spike
**What happens**: 100,000 users visit your site.
1. **Prometheus** sees that `requests_per_second` jumped from 100 to 5000.
2. **Grafana** shows a massive spike on the TV dashboard in the office.
3. **Alertmanager** sends a Slack message to the DevOps team: "High Traffic Alert".
4. DevOps team uses this data to trigger auto-scaling to add more VMs.

### Scenario 2: Bug in Production
**What happens**: Users complain they can't checkout.
1. You open **Kibana**.
2. You search for `level: "ERROR" AND message: "checkout"`.
3. You immediately find 50 logs saying `Database Connection Timeout`.
4. You fix the database connection pool.

---

## 🧠 Summary
1. **Prometheus**: Collects numbers (Metrics).
2. **Grafana**: Makes beautiful graphs from those numbers.
3. **ELK Stack**: Centralizes text logs so you can search them like Google.

## ✅ Quick Quiz
1. You want to see a line graph of your server's memory usage over the last 24 hours. What tool do you look at?
   > **Answer**: Grafana 📈
2. You want to find out WHY a specific user login failed at 3:00 PM. What tool do you use?
   > **Answer**: Kibana (ELK stack) to search the text logs 📝
