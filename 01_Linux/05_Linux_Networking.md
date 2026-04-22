# 05 — Linux Networking

## 1. Network Interface Management

```bash
# Show all interfaces with addresses
ip addr show
ip a                       # shorthand

# Show a specific interface
ip addr show eth0
ip addr show lo

# Bring interface up/down
sudo ip link set eth0 up
sudo ip link set eth0 down

# Add an IP to an interface (temporary — lost on reboot)
sudo ip addr add 10.0.1.100/24 dev eth0
sudo ip addr del 10.0.1.100/24 dev eth0

# Rename interface
sudo ip link set eth0 name wan

# Show interface statistics (errors, drops)
ip -s link show eth0

# Network interface speed / duplex
ethtool eth0
ethtool -i eth0            # driver info

# OLD commands (deprecated but still present on many systems)
ifconfig                   # equivalent to ip addr
ifconfig eth0
ifconfig eth0 up/down
```

______________________________________________________________________

## 2. Routing

```bash
# View routing table
ip route show
ip r                       # shorthand
route -n                   # classic (numeric, no DNS lookup)
netstat -rn                # classic routing table

# Add a static route
sudo ip route add 192.168.10.0/24 via 10.0.0.1
sudo ip route add 192.168.10.0/24 dev eth1
sudo ip route add default via 10.0.0.1     # default gateway

# Delete a route
sudo ip route del 192.168.10.0/24 via 10.0.0.1

# Persistent routes (Ubuntu /etc/netplan/ or RHEL /etc/sysconfig/network-scripts/)
# Ubuntu Netplan example:
sudo vim /etc/netplan/01-network.yaml
# network:
#   ethernets:
#     eth0:
#       dhcp4: no
#       addresses: [10.0.1.100/24]
#       gateway4: 10.0.0.1
#       nameservers:
#         addresses: [8.8.8.8, 1.1.1.1]
#   routes:
#     - to: 192.168.10.0/24
#       via: 10.0.0.1
sudo netplan apply

# Test routing
ip route get 8.8.8.8        # which route would be used?
traceroute 8.8.8.8
tracepath 8.8.8.8            # no root required
```

______________________________________________________________________

## 3. DNS

```bash
# DNS resolution tools
nslookup google.com
nslookup google.com 8.8.8.8       # use specific DNS server

dig google.com                    # detailed
dig google.com A                  # IPv4 record
dig google.com AAAA               # IPv6 record
dig google.com MX                 # mail exchange
dig google.com NS                 # name servers
dig google.com TXT                # text records
dig @8.8.8.8 google.com           # use specific resolver
dig +short google.com             # IP only
dig +trace google.com             # full trace from root

host google.com                   # simple lookup

# Test reverse DNS (IP to hostname)
dig -x 8.8.8.8
nslookup 8.8.8.8

# /etc/resolv.conf — DNS configuration
cat /etc/resolv.conf
# nameserver 8.8.8.8
# nameserver 1.1.1.1
# search company.com internal.company.com
# options ndots:5

# /etc/hosts — local overrides (checked before DNS)
echo "10.0.1.50  db-primary.internal" | sudo tee -a /etc/hosts
echo "10.0.1.51  db-replica.internal" | sudo tee -a /etc/hosts

# Clear DNS cache
sudo systemctl restart systemd-resolved      # Ubuntu
sudo resolvectl flush-caches
sudo rndc flush                              # bind9

# Real-Time Scenario: Diagnose DNS failures
dig google.com @8.8.8.8 +short              # test with Google DNS
dig google.com @/etc/resolv.conf            # test with local resolver
cat /etc/nsswitch.conf | grep hosts         # check resolution order
```

______________________________________________________________________

## 4. Port and Socket Inspection

```bash
# ss — modern socket statistics (replaces netstat)
ss -tlnp          # TCP, listening, numeric, with process
ss -ulnp          # UDP, listening, numeric, with process
ss -tlnp sport = :80  # specific port
ss -tnp           # all TCP with processes
ss -anp           # all sockets
ss -s             # summary statistics

# State meanings: LISTEN, ESTABLISHED, TIME-WAIT, CLOSE-WAIT, SYN-SENT

# netstat — classic (install net-tools)
netstat -tlnp     # TCP listening with processes
netstat -ulnp     # UDP listening
netstat -an       # all connections
netstat -rn       # routing table
netstat -s        # statistics by protocol

# lsof — list open files/sockets
lsof -i           # all network connections
lsof -i :80       # processes using port 80
lsof -i :80 -i :443   # multiple ports
lsof -i TCP -i UDP
lsof -i -n -P     # numeric, no port name resolution
lsof -p 1234      # open files for PID 1234
lsof -u appuser   # open files for user

# Find what's using a port
fuser 80/tcp
fuser -k 8080/tcp  # kill process using port

# Real-Time Scenario: What's running on port 8080?
ss -tlnp | grep :8080
lsof -i :8080
fuser 8080/tcp
```

______________________________________________________________________

## 5. curl and wget

```bash
# curl — transfer data from/to URLs
curl https://api.example.com
curl -s https://api.example.com              # silent (no progress)
curl -o output.txt https://example.com       # save to file
curl -O https://example.com/file.tar.gz      # save with remote name
curl -L https://example.com                  # follow redirects
curl -I https://example.com                  # headers only (HEAD)
curl -v https://example.com                  # verbose (debug)

# HTTP methods
curl -X POST https://api.example.com/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name": "Vikram", "email": "v@company.com"}'

curl -X PUT https://api.example.com/users/1 \
  -H "Content-Type: application/json" \
  -d '{"status": "active"}'

curl -X DELETE https://api.example.com/users/1 \
  -H "Authorization: Bearer $TOKEN"

# Send file
curl -F "file=@report.pdf" https://api.example.com/upload
curl --data-binary @payload.json https://api.example.com/ingest

# Useful curl options for DevOps
curl -w "%{http_code}\n" -o /dev/null -s https://api.example.com    # status code only
curl --retry 3 --retry-delay 2 https://api.example.com              # retry
curl --max-time 10 https://api.example.com                          # timeout
curl -k https://self-signed.example.com                             # skip SSL
curl --resolve api.example.com:443:10.0.1.50 https://api.example.com  # custom DNS
curl -u user:password https://api.example.com                       # basic auth
curl -b cookies.txt -c cookies.txt https://api.example.com          # cookies

# wget
wget https://example.com/file.tar.gz
wget -O output.tar.gz https://example.com/file.tar.gz
wget -q https://example.com                     # quiet
wget -r -np https://example.com/docs/           # recursive
wget --mirror https://example.com/              # full site mirror
wget --retry-connrefused --tries=3 https://...  # retry
```

______________________________________________________________________

## 6. SSH — Secure Shell

```bash
# Basic connection
ssh user@hostname
ssh -p 2222 user@hostname              # non-standard port
ssh -i ~/.ssh/my-key.pem user@hostname # specific key

# Execute command remotely
ssh user@server "systemctl status nginx"
ssh user@server "df -h && free -m"

# SSH with agent forwarding (use your local keys on remote)
ssh -A user@jumphost "ssh appserver 'systemctl restart app'"

# Copy files
scp file.txt user@server:/tmp/
scp user@server:/var/log/app.log ./
scp -r ./config/ user@server:/opt/app/
scp -P 2222 file.txt user@server:/tmp/  # non-standard port

# rsync — efficient sync (only transfers changes)
rsync -avz ./app/ user@server:/opt/app/
rsync -avz --delete ./app/ user@server:/opt/app/   # mirror (delete extra)
rsync -avz --exclude='.git' --exclude='node_modules' . user@server:/opt/app/
rsync -avz -e "ssh -p 2222" ./app/ user@server:/opt/app/  # custom port
rsync -n -avz ./app/ user@server:/opt/app/                # dry run

# SSH tunnels
ssh -L 8080:localhost:8080 user@remoteserver   # local forward: access remote port locally
ssh -R 9090:localhost:3000 user@remoteserver   # remote forward: expose local port remotely
ssh -D 1080 user@remoteserver                  # SOCKS proxy

# SSH config (~/.ssh/config)
cat >> ~/.ssh/config << 'EOF'
Host prod-jump
  HostName 52.14.55.100
  User ubuntu
  IdentityFile ~/.ssh/prod-key.pem
  ServerAliveInterval 60

Host prod-app
  HostName 10.0.1.50
  User appuser
  IdentityFile ~/.ssh/prod-key.pem
  ProxyJump prod-jump          # jump through prod-jump bastion

Host dev-*
  User developer
  IdentityFile ~/.ssh/dev-key.pem
  StrictHostKeyChecking no
  UserKnownHostsFile /dev/null
EOF

# Now connect simply:
ssh prod-app
```

______________________________________________________________________

## 7. Firewall Management

### UFW (Ubuntu)

```bash
# Enable/disable
sudo ufw enable
sudo ufw disable
sudo ufw status
sudo ufw status verbose

# Allow/deny by port
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 8080/tcp
sudo ufw deny 3306/tcp             # block MySQL from outside

# Allow/deny by service name
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'

# Allow from specific IP
sudo ufw allow from 10.0.0.0/8 to any port 22
sudo ufw allow from 192.168.1.100 to any port 5432   # PostgreSQL from specific host

# Delete rules
sudo ufw delete allow 8080/tcp
sudo ufw delete 3                  # delete rule #3 (from status numbered)

# Reset all rules
sudo ufw reset

# Logging
sudo ufw logging on
sudo ufw logging high
```

### firewalld (RHEL/CentOS/Amazon Linux)

```bash
# Start and enable
sudo systemctl enable --now firewalld
sudo firewall-cmd --state

# List everything
sudo firewall-cmd --list-all
sudo firewall-cmd --list-services

# Add/remove services
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --permanent --remove-service=telnet

# Add/remove ports
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --permanent --remove-port=8080/tcp

# Allow from specific source
sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="10.0.0.0/8" port port="22" protocol="tcp" accept'

# Reload after changes
sudo firewall-cmd --reload

# Zones
sudo firewall-cmd --get-default-zone
sudo firewall-cmd --set-default-zone=public
sudo firewall-cmd --zone=trusted --add-source=10.0.0.0/8
```

### iptables (raw — understanding fundamentals)

```bash
# List rules
sudo iptables -L -n -v

# Allow established connections
sudo iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# Allow SSH
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# Allow HTTP/HTTPS
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Block IP
sudo iptables -I INPUT -s 192.168.1.100 -j DROP

# Save iptables rules
sudo iptables-save > /etc/iptables/rules.v4
```

______________________________________________________________________

## 8. Network Diagnostics

```bash
# ping — test connectivity
ping google.com
ping -c 4 google.com               # 4 packets
ping -i 0.5 google.com             # every 0.5 seconds
ping -s 1000 google.com            # larger packet size

# traceroute — trace network path
traceroute google.com
traceroute -n google.com           # numeric (no DNS)
traceroute -T -p 443 google.com    # TCP traceroute to port 443

# mtr — my traceroute (real-time)
mtr google.com
mtr -r -c 10 google.com            # report mode, 10 cycles

# nc (netcat) — network Swiss Army knife
nc -zv google.com 443             # test if port is open
nc -zv 10.0.1.50 3306             # test MySQL port
echo "GET / HTTP/1.0" | nc google.com 80    # raw HTTP request
nc -l 8888                        # listen on port 8888
nc hostname 8888                  # connect to listener

# telnet — test port
telnet hostname 80
telnet smtp.gmail.com 587

# nmap — network scanning
sudo nmap -sS 10.0.1.0/24         # SYN scan subnet
nmap -p 80,443,22 10.0.1.50       # specific ports
nmap -p 1-1024 10.0.1.50          # port range
nmap -sV 10.0.1.50                # service version detection
nmap -O 10.0.1.50                 # OS detection

# Real-Time Scenario: Diagnose intermittent connection to RDS
nc -zv prod-db.us-east-1.rds.amazonaws.com 3306
mtr prod-db.us-east-1.rds.amazonaws.com
ss -tnp | grep 3306
dmesg | grep -i error | tail -20
```

______________________________________________________________________

## 9. Network Configuration Files

```bash
# Ubuntu (Netplan)
/etc/netplan/*.yaml

# RHEL/CentOS
/etc/sysconfig/network-scripts/ifcfg-eth0

# Hostname
hostnamectl set-hostname prod-app-01
cat /etc/hostname
hostnamectl status

# DNS resolver
/etc/resolv.conf
/etc/nsswitch.conf

# Hosts file
/etc/hosts

# Network services
/etc/services              # port number to service name mapping
cat /etc/services | grep http
```

______________________________________________________________________

## Summary Table

| Command | Purpose |
|---------|---------|
| `ip addr show` | Show network interfaces and IPs |
| `ip route show` | Show routing table |
| `ss -tlnp` | Show listening TCP ports + processes |
| `dig domain +short` | DNS lookup |
| `curl -I https://url` | Check HTTP headers |
| `ssh -J jump user@target` | SSH via jump host |
| `rsync -avz src/ user@host:/dst/` | Sync files efficiently |
| `nc -zv host port` | Test port connectivity |
| `mtr host` | Real-time traceroute |
| `ufw allow 80/tcp` | Open firewall port (Ubuntu) |
| `firewall-cmd --add-service=http` | Open firewall (RHEL) |
| `lsof -i :8080` | Who's using port 8080 |
