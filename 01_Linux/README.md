# Linux for DevOps Engineers — Complete Reference

A structured guide covering Linux from fundamentals to advanced DevOps operations with real-world scenarios.

______________________________________________________________________

## Index

| File | Topics Covered |
|------|---------------|
| [01_Linux_Basics.md](01_Linux_Basics.md) | Filesystem, navigation, file ops, text processing, help system |
| [02_Linux_File_Permissions.md](02_Linux_File_Permissions.md) | chmod, chown, umask, ACLs, SUID/SGID, sticky bit |
| [03_Linux_User_Group_Management.md](03_Linux_User_Group_Management.md) | useradd, groups, sudo, PAM, SSH access control |
| [04_Linux_Process_Management.md](04_Linux_Process_Management.md) | ps, top, kill, systemctl, journalctl, cron, at |
| [05_Linux_Networking.md](05_Linux_Networking.md) | ip, ss, netstat, curl, firewall, DNS, routing, VPC |
| [06_Linux_Storage_Filesystem.md](06_Linux_Storage_Filesystem.md) | df, du, lsblk, fdisk, LVM, mount, EBS, swap |
| [07_Linux_Shell_Scripting.md](07_Linux_Shell_Scripting.md) | Variables, arrays, loops, functions, error handling, best practices |
| [08_Linux_Performance_Monitoring.md](08_Linux_Performance_Monitoring.md) | top, vmstat, iostat, sar, strace, lsof, perf |
| [09_Linux_Security_Hardening.md](09_Linux_Security_Hardening.md) | SSH hardening, firewall, SELinux, auditd, fail2ban |
| [10_Linux_DevOps_Scenarios.md](10_Linux_DevOps_Scenarios.md) | Real-world ops: deployments, debugging, automation, incidents |

______________________________________________________________________

## Quick Reference Card

```bash
# Navigation
pwd; ls -lah; cd -; tree -L 2

# File ops
cp -r src/ dst/; mv old new; rm -rf dir/; ln -s target link

# Text
grep -r "pattern" .; awk '{print $2}'; sed 's/old/new/g'; tail -f app.log

# Process
ps aux | grep app; kill -9 PID; systemctl status nginx; journalctl -fu app

# Network
ss -tlnp; curl -I https://site.com; netstat -rn; ip addr show

# Disk
df -h; du -sh *; lsblk; free -h

# Permissions
chmod 755 script.sh; chown user:group file; sudo -l
```

______________________________________________________________________

> Each file contains real-time DevOps scenarios, command explanations, and production-tested patterns.
