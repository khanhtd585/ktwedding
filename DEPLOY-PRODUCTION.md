# Everafter production deployment runbook (EC2)

This is the single end-to-end guide for deploying the current MVP. It uses one EC2 instance, Docker Compose, Caddy HTTPS, and SQLite on the EC2 EBS disk. Run one application instance only.

## What you need before starting

- An AWS account/role allowed to create CloudFormation, EC2, Elastic IP, IAM role, and security group resources. If an organisation SCP blocks CloudFormation actions, ask the AWS administrator to grant or perform the stack deployment.
- A domain you control, such as `photos.example.com`.
- Your existing Google OAuth client ID, client secret, Google Picker API key, Fernet encryption key, and session secret. Do not place these values in CloudFormation.
- An EC2 key pair and your current public IP address if you want the simplest source-code upload path using SSH/SCP. For example, `203.0.113.10/32`.

## 1. Create the EC2 infrastructure

1. Open **AWS CloudFormation → Create stack → With new resources**.
2. Upload [infra/cloudformation/everafter-ec2.yml](infra/cloudformation/everafter-ec2.yml).
3. Enter the required `VpcId` and a **public** `SubnetId` (a subnet with Internet Gateway routing).
4. Use these recommended parameters:

   | Parameter | Value |
   | --- | --- |
   | `InstanceType` | `t3.small` |
   | `RootVolumeGiB` | `30` |
   | `KeyName` | your EC2 key pair |
   | `AllowedSshCidr` | your public IP with `/32` |
   | `RepositoryUrl` | leave blank unless it is a public Git repository |
   | `DomainName` | `photos.example.com` |
   | `HostedZoneId` | Route 53 hosted zone ID, or leave blank for external DNS |

5. Create the stack and wait for `CREATE_COMPLETE`.
6. Copy its `ElasticIpAddress` output. If you did not enter `HostedZoneId`, create an `A` record at your DNS provider: `photos.example.com` → that IP.

The template installs Docker, Docker Compose and Make, assigns a stable Elastic IP, and only opens ports 80/443 publicly. Deleting the stack also deletes its EBS volume and all SQLite data, so back up data before deleting a stack if it must be retained.

## 2. Upload this project to the new server

From PowerShell on your computer, replace the placeholders and run:

```powershell
scp -i C:\path\to\your-key.pem -r C:\path\to\everafter-mvp ubuntu@YOUR_ELASTIC_IP:/tmp/
ssh -i C:\path\to\your-key.pem ubuntu@YOUR_ELASTIC_IP
```

On EC2, install the uploaded source into the directory prepared by CloudFormation:

```bash
sudo cp -a /tmp/everafter-mvp/. /opt/everafter/
sudo rm -f /opt/everafter/.env
sudo chown -R ubuntu:ubuntu /opt/everafter
cd /opt/everafter
make setup
```

`make setup` creates `.env.production` and makes the SQLite data directory writable by the non-root app container.

If you supplied a public `RepositoryUrl` to CloudFormation, skip the SCP step and start at `cd /opt/everafter`.

## 3. Configure production secrets

Edit the production configuration:

```bash
cd /opt/everafter
nano .env.production
```

Set these values:

```dotenv
DOMAIN=photos.example.com
GOOGLE_REDIRECT_URI=https://photos.example.com/auth/google/callback
DEMO_MODE=false
COOKIE_SECURE=true
DATABASE_PATH=/data/everafter.sqlite3
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_PICKER_API_KEY=...
TOKEN_ENCRYPTION_KEY=...
SESSION_SECRET=...
```

Copy secret values from your safe local source. Keep `TOKEN_ENCRYPTION_KEY` unchanged permanently after the first real login, otherwise stored Google Drive tokens can no longer be decrypted.

## 4. Start the application and HTTPS

Before this step, make sure the domain A record resolves to the Elastic IP and that ports 80/443 are reachable. Caddy needs this to obtain its TLS certificate.

```bash
cd /opt/everafter
make validate
make deploy
```

Expected result:

```text
{"status":"ok"}
```

If it fails, run:

```bash
make ps
make logs-check TAIL=300
make logs-app
make logs-proxy
```

## 5. Complete Google Cloud production setup

In your existing Google OAuth **Web application** client, add exactly:

```text
Authorized JavaScript origin: https://photos.example.com
Authorized redirect URI: https://photos.example.com/auth/google/callback
```

The redirect URI must exactly match `GOOGLE_REDIRECT_URI`. Ensure Google Drive API and Google Picker API remain enabled. If the OAuth consent screen is still in Testing mode, add every intended bride, groom, and studio test account to **Test users**, or complete Google verification before opening the app to the public.

## 6. Final acceptance test

1. Open `https://photos.example.com` in an incognito browser.
2. Sign in with Google.
3. Create a project, choose a Drive folder, and confirm thumbnails load.
4. Invite a second Google account and open the invitation link.
5. Like a photo, add a note and export an XLSX.
6. Confirm `make logs-check` contains no server errors.

## Routine operations

```bash
make deploy             # deploy an update / rebuild containers
make ps                 # container status
make logs-check         # recent logs, then return
make logs               # follow logs live; Ctrl+C to stop viewing
make health             # public HTTPS health check
make restart            # restart containers
make down               # stop containers; keeps SQLite data
```

Back up `/opt/everafter/data/everafter.sqlite3` and `.env.production` securely. The database and encryption key are both required to recover active projects and Google connections.
