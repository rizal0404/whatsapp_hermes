# VPS Deployment Guide - WhatsApp API Gateway

This document provides step-by-step instructions on deploying the WhatsApp API Gateway to a single VPS instance in production using Docker Compose, configuring Nginx as a reverse proxy, setting up SSL certificates, and establishing a regular backup routine.

---

## 📋 Table of Contents
1. [Prerequisites](#1-prerequisites)
2. [VPS Host Preparation](#2-vps-host-preparation)
3. [Cloning & Configuration](#3-cloning--configuration)
4. [Deployment Procedures](#4-deployment-procedures)
5. [Nginx Reverse Proxy & SSL Setup](#5-nginx-reverse-proxy--ssl-setup)
6. [Security Best Practices](#6-security-best-practices)
7. [Backup & Restoration Strategy](#7-backup--restoration-strategy)
8. [Troubleshooting & Monitoring](#8-troubleshooting--monitoring)

---

## 1. Prerequisites

- A VPS running **Ubuntu 22.04 LTS** (or similar Linux distro) with at least:
  - 1 Core CPU
  - 1 GB RAM (minimum, 2 GB recommended)
  - 20 GB SSD Storage
- A public domain or subdomain pointing to your VPS IP address (e.g., `wa-gateway.example.com`).
- WhatsApp phone account ready to scan the QR code.

---

## 2. VPS Host Preparation

### Update Host Packages
Log in to your VPS via SSH and run:
```bash
sudo apt update && sudo apt upgrade -y
```

### Configure Swap (Optional, recommended for 1GB RAM)
If your VPS has only 1GB RAM, configure a swap file to prevent out-of-memory crashes:
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Install Docker and Docker Compose
Install Docker Engine and Docker Compose:
```bash
# Add Docker's official GPG key:
sudo apt update
sudo apt install ca-certificates curl gnupg lsb-release -y
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up the repository:
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io docker-compose-plugin -y
```

Verify installation:
```bash
docker --version
docker compose version
```

---

## 3. Cloning & Configuration

Create an application directory on your VPS, clone the repository, and set up your production configuration.

```bash
mkdir -p /opt/wa-gateway
git clone <repository_url> /opt/wa-gateway
cd /opt/wa-gateway
```

### Set Up Environment File
Create `/opt/wa-gateway/.env` based on `.env.production`:
```bash
cp .env.production .env
```

Edit the file to configure secure values:
```bash
nano .env
```

Make sure to change the following values:
- `API_KEY`: Generate a secure, 32-character random string (e.g., `openssl rand -hex 16`).
- `POSTGRES_PASSWORD`: Use a strong password for your database container initialization.
- `DATABASE_URL`: Update the password inside the connection string to exactly match `POSTGRES_PASSWORD`. Example: `postgresql://postgres:YOUR_PASSWORD@postgres:5432/wa_gateway?schema=public` (keep the host as `postgres` inside the Docker network).
- `ALLOWED_FILE_DOMAINS`: Add your Hermes domain name and any other storage domains, separated by commas.

> [!IMPORTANT]
> The database password in `POSTGRES_PASSWORD` and the password inside the `DATABASE_URL` connection string must match exactly.
>
> Note: The `.env.production` file is ignored by Git, so your credentials will not be committed or modified by `git pull`. Any custom credentials should be configured in `.env`.

---

## 4. Deployment Procedures

Launch the application composition:

```bash
docker compose up -d --build
```

### Post-Deployment Verification
Check the status of the containers and wait for them to show `healthy`:
```bash
docker compose ps
```

Verify the API server health check endpoint works internally:
```bash
curl -i http://localhost:3000/health
```
You should receive a `200 OK` response with a JSON payload certifying database and Redis connections are up.

---

## 5. Nginx Reverse Proxy & SSL Setup

Exposing port 3000 directly is unsafe. We use Nginx to reverse proxy traffic and terminate SSL (HTTPS).

### Install Nginx and Certbot
```bash
sudo apt install nginx certbot python3-certbot-nginx -y
```

### Configure Nginx Server Block
Create a configuration block for your subdomain:
```bash
sudo nano /etc/nginx/sites-available/wa-gateway.conf
```

Add the following configuration (replace `wa-gateway.example.com` with your actual domain):
```nginx
server {
    listen 80;
    server_name wa-gateway.example.com;

    # Expose only health check publicly (optional, if you want unauthenticated uptime checking)
    location /health {
        proxy_pass http://localhost:3000/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # All API endpoints
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Support WebSocket connection for Baileys if needed (though not directly exposed in endpoints)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Security: set client body limits to 25MB max
        client_max_body_size 25m;
    }
}
```

Enable the site and test Nginx configuration:
```bash
sudo ln -s /etc/nginx/sites-available/wa-gateway.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Obtain SSL Certificate via Let's Encrypt
Run Certbot to automate SSL setup:
```bash
sudo certbot --nginx -d wa-gateway.example.com
```
Follow the interactive prompts. Choose to **Redirect HTTP traffic to HTTPS**.

Verify your domain is now accessible securely over HTTPS:
```bash
curl -H "X-API-Key: <your_api_key>" https://wa-gateway.example.com/v1/sessions
```

---

## 6. Security Best Practices

1. **Firewall Settings**: Ensure the VPS firewall blocks public access to ports `5432` (Postgres) and `6379` (Redis). Only Nginx ports `80` and `443` and SSH port `22` should be exposed.
   ```bash
   sudo ufw default deny incoming
   sudo ufw default allow outgoing
   sudo ufw allow ssh
   sudo ufw allow http
   sudo ufw allow https
   sudo ufw enable
   ```
2. **Access Control**: Keep your `API_KEY` hidden. Never commit your `.env` file to version control.
3. **Session Credentials Storage**: The directory holding WhatsApp auth tokens is stored in a Docker volume `wa_auth` (`/app/auth` inside the container). Access to this folder should be limited to the root/docker user.

---

## 7. Backup & Restoration Strategy

Since Baileys maintains state files and Postgres holds message logs/recipients, regular backups are necessary.

### 1. Database Backups
Create a cron job on the VPS to dump the PostgreSQL database daily:
```bash
# Create a backup folder
sudo mkdir -p /var/backups/wa-gateway/db

# Write script
sudo nano /usr/local/bin/backup-wa-db.sh
```

Add the following to `/usr/local/bin/backup-wa-db.sh`:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/wa-gateway/db"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="wa_db_backup_${TIMESTAMP}.sql"

# Executepg_dump inside Postgres container
docker compose -f /opt/wa-gateway/docker-compose.yml exec -T postgres pg_dump -U postgres wa_gateway > "${BACKUP_DIR}/${FILENAME}"

# Compress
gzip "${BACKUP_DIR}/${FILENAME}"

# Prune backups older than 14 days
find "${BACKUP_DIR}" -name "*.sql.gz" -mtime +14 -delete
```

Make the script executable:
```bash
sudo chmod +x /usr/local/bin/backup-wa-db.sh
```

### 2. WhatsApp Credentials Backups
To prevent having to re-scan the QR code if the VPS crashes, back up the WhatsApp auth credentials volume.

Create a credentials backup script `/usr/local/bin/backup-wa-creds.sh`:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/wa-gateway/creds"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="wa_creds_backup_${TIMESTAMP}.tar.gz"

sudo mkdir -p "${BACKUP_DIR}"

# Create a tar of the docker volume directory
# By default, Docker volume paths are under /var/lib/docker/volumes
sudo tar -czf "${BACKUP_DIR}/${FILENAME}" -C /var/lib/docker/volumes/wa-gateway_wa_auth/_data .

# Prune backups older than 30 days
find "${BACKUP_DIR}" -name "*.tar.gz" -mtime +30 -delete
```

Make it executable:
```bash
sudo chmod +x /usr/local/bin/backup-wa-creds.sh
```

### 3. Setup Cron Jobs
Run `sudo crontab -e` and add the schedules:
```cron
# Backup DB at 2:00 AM daily
0 2 * * * /usr/local/bin/backup-wa-db.sh

# Backup WhatsApp Credentials at 3:00 AM daily
0 3 * * * /usr/local/bin/backup-wa-creds.sh
```

---

## 8. Troubleshooting & Monitoring

### View Logs
To check the logs of your API gateway service:
```bash
docker compose logs -f wa-gateway
```

To view database logs:
```bash
docker compose logs -f postgres
```

### Recovering a Disconnected Session
If the session goes to `DISCONNECTED` or `ERROR`:
1. Check the session status via `GET /v1/sessions/:sessionId/status`.
2. If it is permanently disconnected, trigger a logout: `POST /v1/sessions/:sessionId/logout`.
3. Re-create the session via `POST /v1/sessions` and scan the newly generated QR code returned by `GET /v1/sessions/:sessionId/qr`.
