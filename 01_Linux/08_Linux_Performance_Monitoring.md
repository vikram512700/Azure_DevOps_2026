# 🐧 08 — Performance Monitoring & Troubleshooting

## 📌 1. System Overview — Quick Snapshot

```bash
# One-liner system overview
echo "=== UPTIME ===" && uptime
echo "=== CPU ===" && lscpu | grep -E "Model name|Socket|Core|Thread"
echo "=== MEMORY ===" && free -h
echo "=== DISK ===" && df -h --total | grep -E "Filesystem|total"
echo "=== LOAD ===" && cat /proc/loadavg
echo "=== TOP PROCESSES ===" && ps aux --sort=-%cpu | head -6

# System info
uname -a                    # kernel version
uname -r                    # kernel version only
cat /etc/os-release         # distro info
hostnamectl                 # hostname + OS + kernel
lscpu                       # CPU details
lshw -short                 # hardware summary
dmidecode -t processor      # CPU from DMI (root)
cat /proc/cpuinfo           # raw CPU info
nproc                       # number of available CPUs
```

______________________________________________________________________

## 📌 2. CPU Monitoring

```bash
# top — interactive
top
top -b -n 1 -o %CPU          # batch, sorted by CPU

# mpstat — per-CPU stats (install: sysstat)
mpstat                       # all CPUs
mpstat -P ALL 1              # per-CPU every second
mpstat 1 5                   # every 1s for 5 iterations

# vmstat — virtual memory + CPU stats
vmstat                       # snapshot
vmstat 2 10                  # every 2s for 10 iterations
# Output columns:
# procs: r=run queue  b=blocked
# cpu: us=user  sy=system  id=idle  wa=iowait  st=stolen(VM)

# sar — System Activity Reporter (sysstat)
sar -u 1 5                   # CPU utilization every 1s
sar -u -f /var/log/sysstat/sa$(date +%d)   # historical today

# pidstat — per-process CPU stats
pidstat 1                    # every second
pidstat -p 1234 1            # specific PID
pidstat -u -p ALL 1          # all processes

# Interpreting load average:
# load average: 0.52, 0.48, 0.44 (1m, 5m, 15m)
# Rule: load / CPU_count
# < 1.0  = system is underloaded (good)
# = 1.0  = fully loaded
# > 1.0  = overloaded (processes queuing)

# Count CPUs for reference
nproc --all
grep -c processor /proc/cpuinfo

# Real-Time Scenario: CPU at 100% — find the culprit
top -b -n 1 -o %CPU | head -15      # top CPU consumers
ps aux --sort=-%cpu | head -10
pidstat -u 1 5 | sort -k8 -rn       # by CPU over 5 seconds
strace -p <PID> -e trace=all -c     # what syscalls is it making?
```

______________________________________________________________________

## 📌 3. Memory Monitoring

```bash
# Memory overview
free -h                      # human readable
free -m                      # in MB
free -s 2 -c 5               # every 2s, 5 times

# Output:
#               total   used    free    shared  buff/cache  available
# Mem:          15.5G   8.3G    2.1G    512M    5.1G        6.5G
# Swap:         2.0G    200M    1.8G

# Key: "available" is what apps can actually use (free + reclaimable cache)

# Detailed memory info
cat /proc/meminfo
grep -E "MemTotal|MemFree|MemAvailable|Cached|Buffers|SwapTotal|SwapFree" /proc/meminfo

# Memory by process (sorted)
ps aux --sort=-%mem | head -10

# smem — accurate memory per-process
sudo smem -t -k                # summary
sudo smem -r -k | head -20    # by RSS

# pmap — memory map of a process
pmap -x 1234

# vmstat memory columns
vmstat -s
# si = swap in per second
# so = swap out per second (if non-zero, you're swapping — bad)

# OOM (Out of Memory) Killer events
dmesg | grep -i "oom\|killed process"
grep -i "out of memory\|oom" /var/log/syslog | tail -20

# Real-Time Scenario: Memory leak investigation
# 1. Identify the leaking process
ps aux --sort=-%mem | head -5

# 2. Watch it over time
watch -n 5 'ps -p <PID> -o pid,vsz,rss,pmem,comm'

# 3. Check its memory map
pmap -x <PID> | tail -5

# 4. valgrind (for C/C++) — run the app under valgrind
valgrind --leak-check=full ./my-app
```

______________________________________________________________________

## 📌 4. Disk I/O Monitoring

```bash
# iostat — I/O statistics (sysstat)
iostat                        # snapshot
iostat -x 2 5                 # extended stats every 2s for 5 iterations
iostat -d /dev/sda 1          # specific device

# Key iostat fields:
# %util    = % of time device was busy (> 70% is concerning)
# await    = average wait time (ms) for I/O requests
# r/s, w/s = reads/writes per second
# rkB/s, wkB/s = read/write KB per second

# iotop — top-like I/O monitor
sudo iotop
sudo iotop -o                  # only show processes with I/O

# pidstat I/O
pidstat -d 1                   # I/O per process every second

# sar I/O
sar -b 1 5                     # block device stats
sar -d 1 5                     # per-device stats

# dstat — versatile resource stats (combines vmstat, iostat, netstat)
dstat                          # everything
dstat -cdngy 5                 # CPU, disk, net, GPU, paging
dstat --top-io                 # show top I/O processes
dstat --top-cpu --top-mem      # show top CPU and memory processes

# lsblk I/O stats
cat /sys/block/sda/stat

# Find I/O-intensive processes
iotop -bo -d 5 -n 3            # batch, only with I/O, 3 iterations
```

______________________________________________________________________

## 📌 5. Network Monitoring

```bash
# ss — socket statistics (already covered in networking)
ss -s                          # socket summary
watch -n 1 'ss -s'             # live socket summary

# sar network
sar -n DEV 1 5                 # network interface stats
sar -n EDEV 1 5                # network error stats

# nethogs — bandwidth per process
sudo nethogs
sudo nethogs eth0

# iftop — bandwidth per connection
sudo iftop
sudo iftop -i eth0 -n          # numeric

# nload — per-interface bandwidth graph
nload eth0

# tcpdump — packet capture
sudo tcpdump -i eth0                          # all traffic on eth0
sudo tcpdump -i eth0 port 80                  # port 80 only
sudo tcpdump -i eth0 host 10.0.1.50           # from/to specific host
sudo tcpdump -i eth0 -w capture.pcap          # write to file
sudo tcpdump -r capture.pcap                  # read from file
sudo tcpdump -i eth0 'tcp[13] & 2 != 0'       # SYN packets
sudo tcpdump -i eth0 port 3306 -A             # MySQL traffic (plaintext)
sudo tcpdump -n -i eth0 'port 443 or port 80' -c 100  # 100 packets

# Real-Time Scenario: High network traffic investigation
sar -n DEV 1 5                  # what interface is saturated?
sudo nethogs                    # which process is consuming bandwidth?
sudo tcpdump -i eth0 -n -c 1000 | awk '{print $3}' | cut -d. -f1-4 | sort | uniq -c | sort -rn
# → top source IPs
```

______________________________________________________________________

## 📌 6. System Call Tracing (strace, ltrace)

```bash
# strace — trace system calls of a running process
strace -p 1234                          # attach to running process
strace -p 1234 -e trace=network         # only network syscalls
strace -p 1234 -e trace=file            # only file syscalls
strace -p 1234 -c                       # summary statistics
strace -p 1234 -T                       # show time spent in syscalls

# Run a program under strace
strace ./my-program
strace -o trace.txt ./my-program        # write to file
strace -f ./my-program                  # follow forks (children)

# ltrace — trace library calls
ltrace ./my-program
ltrace -p 1234

# Real-Time Scenario: App is slow — what is it waiting on?
strace -p $(pgrep payment-service) -e trace=read,write,recv,send -T 2>&1 | head -50
# Look for slow syscalls (large -T values)

# What files is a process accessing?
strace -p 1234 -e trace=open,read,write,close 2>&1 | grep "open("
```

______________________________________________________________________

## 📌 7. lsof — List Open Files

```bash
# All open files
lsof | head -30

# Open files by process
lsof -p 1234
lsof -p $(pgrep nginx)

# Open files by user
lsof -u appuser

# Open network connections
lsof -i
lsof -i TCP
lsof -i :8080
lsof -i @10.0.1.50

# Files opened in a directory
lsof +D /opt/app/

# Who has a file open (before unmounting)
lsof /mnt/data

# Find deleted files still held open (disk leak)
lsof | grep deleted

# Real-Time Scenario: Disk space not freed after deleting large log
# Log file deleted but process still holds it open → disk not freed
lsof | grep deleted
# output: java  1234  appuser  47u  REG  ...  (deleted) /var/log/app.log

# Fix: tell the process to close/reopen logs
kill -HUP 1234          # if app supports HUP for log reopen
# or restart the process
```

______________________________________________________________________

## 📌 8. perf — Linux Performance Counters

```bash
# Install
sudo apt install linux-tools-$(uname -r)

# CPU statistics
sudo perf stat ls /tmp

# Profile a command
sudo perf record -g ./my-app
sudo perf report                        # interactive report

# Profile a running process
sudo perf record -g -p 1234 sleep 30   # record for 30 seconds
sudo perf report

# Top-like view
sudo perf top
sudo perf top -p 1234                   # specific PID

# Flame graph generation
sudo perf record -F 99 -g -p 1234 -- sleep 60
sudo perf script | /opt/FlameGraph/stackcollapse-perf.pl | /opt/FlameGraph/flamegraph.pl > flame.svg
```

______________________________________________________________________

## 📌 9. System Logs

```bash
# Key log locations
/var/log/syslog           # general system messages (Debian/Ubuntu)
/var/log/messages         # general (RHEL/CentOS)
/var/log/auth.log         # authentication (Debian/Ubuntu)
/var/log/secure           # authentication (RHEL/CentOS)
/var/log/kern.log         # kernel messages
/var/log/dmesg            # kernel ring buffer
/var/log/boot.log         # boot messages
/var/log/nginx/           # nginx logs
/var/log/apache2/         # apache logs
/var/log/mysql/           # MySQL logs
/var/log/journal/         # systemd journal

# Real-time log monitoring
tail -f /var/log/syslog
tail -F /var/log/nginx/error.log       # -F follows rotated files
multitail /var/log/nginx/access.log /var/log/app/app.log  # multiple files

# dmesg — kernel ring buffer
dmesg
dmesg -T                               # human-readable timestamps
dmesg -T | grep -i error
dmesg -T | grep -i "oom\|killed"
dmesg -T | grep -i "disk\|sda\|nvme"  # disk errors
dmesg --follow                         # live stream (like -f)
dmesg -l err,warn                      # filter by level

# Log analysis snippets
# Top 10 IPs hitting nginx
awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head -10

# 5xx errors in nginx
grep '" 5[0-9][0-9] ' /var/log/nginx/access.log | awk '{print $9}' | sort | uniq -c | sort -rn

# Authentication failures
grep "Failed password" /var/log/auth.log | awk '{print $11}' | sort | uniq -c | sort -rn
```

______________________________________________________________________

## 📌 10. Performance Monitoring Tools Summary

| Tool | Monitors | Install |
|------|----------|---------|
| `top / htop` | CPU, Memory, Processes | htop: apt install htop |
| `vmstat` | CPU, Memory, I/O, Swap | sysstat |
| `iostat` | Disk I/O per device | sysstat |
| `mpstat` | Per-CPU utilization | sysstat |
| `sar` | Historical performance data | sysstat |
| `iotop` | I/O per process | apt install iotop |
| `nethogs` | Bandwidth per process | apt install nethogs |
| `iftop` | Bandwidth per connection | apt install iftop |
| `tcpdump` | Packet capture | usually pre-installed |
| `strace` | System call tracing | usually pre-installed |
| `lsof` | Open files and sockets | usually pre-installed |
| `dstat` | All-in-one stats | apt install dstat |
| `perf` | CPU performance counters | linux-tools-$(uname -r) |

```bash
# Install all sysstat tools at once
sudo apt install sysstat

# Enable sysstat data collection
sudo sed -i 's/ENABLED="false"/ENABLED="true"/' /etc/default/sysstat
sudo systemctl restart sysstat
# Now sar can show historical data
sar -u              # today's CPU history
sar -r              # today's memory history
```

______________________________________________________________________

> [!TIP]
> **Pro Tip:** Practice these commands in a lab environment to build muscle memory!
