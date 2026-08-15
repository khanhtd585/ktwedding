# Deploy Everafter on one EC2 instance

This is the recommended deployment for the current MVP: one Docker Compose stack, SQLite persisted on the EC2 disk, and Caddy for automatic HTTPS. Do not use it to run multiple application instances; SQLite is deliberately a single-writer database here.

## Before you begin

You need a domain you control, for example `photos.example.com`. Google OAuth in production requires HTTPS and the exact callback URL; an EC2 public IP alone is not sufficient.

## 1. Create the EC2 instance

1. Launch an **Ubuntu 24.04 LTS** EC2 instance. `t3.small` with a 30 GB gp3 EBS volume is a sensible MVP starting point.
2. Allocate and associate an **Elastic IP** with the instance. It keeps the IP stable when the instance is stopped and started.
3. Create a security group with these inbound rules:

   - TCP `22` from your own public IP only (administration).
   - TCP `80` from `0.0.0.0/0` (HTTP redirect and certificate validation).
   - TCP `443` from `0.0.0.0/0` (the app).

4. In the domain's DNS provider, add an `A` record from `photos.example.com` to the Elastic IP. Wait until it resolves publicly before starting Caddy.

## 2. Configure Google OAuth

In Google Cloud Console, add this exact URL to **Authorized redirect URIs** for the existing Web client:

```text
https://photos.example.com/auth/google/callback
```

Also add `https://photos.example.com` to the authorised JavaScript origins if Google Picker requires it. Replace the example domain with your real domain everywhere.

## 3. Install Docker on Ubuntu

Connect to the instance:

```bash
ssh -i /path/to/key.pem ubuntu@YOUR_ELASTIC_IP
```

Install Docker Engine and the Compose plugin using Docker's official Ubuntu instructions. Then verify:

```bash
docker --version
docker compose version
```

## 4. Upload the application and production configuration

Copy the project to `/opt/everafter` (via Git, `scp`, or a deployment pipeline), then on EC2:

```bash
sudo mkdir -p /opt/everafter
sudo chown ubuntu:ubuntu /opt/everafter
cd /opt/everafter
cp .env.production.example .env.production
mkdir -p data
sudo chown 10001:10001 data
```

The ownership command lets the non-root application container write SQLite safely. Edit `.env.production`. Supply your real Google values and secrets, set `DOMAIN` to the public domain, and make `GOOGLE_REDIRECT_URI` match it exactly. Never commit this file.

Generate secrets if needed:

```bash
openssl rand -hex 32
docker run --rm python:3.12-slim python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

## 5. Start and verify

The included Makefile provides the usual deployment and log commands. Run it from `/opt/everafter`:

```bash
make setup       # first time only; creates .env.production and data/
nano .env.production
make validate
make deploy
```

`make deploy` starts the containers and verifies `https://DOMAIN/healthz`. For diagnostics, use `make ps`, `make logs-check`, `make logs-app`, or `make logs-proxy`. Add `TAIL=500` when you need more historical log lines.

The equivalent direct Docker command is:

```bash
cd /opt/everafter
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
docker compose --env-file .env.production -f docker-compose.production.yml ps
curl -I https://photos.example.com/healthz
```

Expected health response is `200 OK`. Caddy obtains and renews the TLS certificate automatically. Inspect failures with:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml logs -f caddy everafter
```

## Updates and backup

To deploy application changes:

```bash
cd /opt/everafter
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
```

The database is `/opt/everafter/data/everafter.sqlite3`. Back up the entire `data` directory while the app is stopped, or use SQLite's online backup command. Back up `.env.production` separately and securely: the encryption key must remain unchanged to read existing Google Drive tokens.
