# Fast EC2 deployment with CloudFormation

The template [cloudformation/everafter-ec2.yml](cloudformation/everafter-ec2.yml) creates one Ubuntu 24.04 EC2 instance, an Elastic IP, HTTPS security rules, an SSM instance profile, and installs Docker, Docker Compose, Git, and Make. It does **not** contain Google keys or start the app: those secrets remain in `.env.production` on the instance.

## 1. Choose networking inputs

In the AWS VPC console, choose a **public subnet** in the desired VPC. It must have a route to an Internet Gateway. Decide whether to use Session Manager (recommended) or a restricted SSH key pair. Do not set `AllowedSshCidr` to `0.0.0.0/0`.

## 2. Create the stack

Open **CloudFormation → Create stack → With new resources**. Upload `cloudformation/everafter-ec2.yml` and fill in:

- `VpcId` and `SubnetId` — required.
- `RepositoryUrl` — optional public Git URL of this Everafter project. If omitted, copy the project to `/opt/everafter` later.
- `DomainName` and `HostedZoneId` — supply both if the domain is hosted in Route 53; otherwise create an A record at your DNS provider using the output `ElasticIpAddress`.
- `KeyName` and `AllowedSshCidr` — optional; leave both blank to use Systems Manager Session Manager.

The current Ubuntu AMI is resolved from the Canonical public SSM parameter at stack creation time, so no region-specific AMI ID is required.

## 3. Finish application configuration

Wait for `CREATE_COMPLETE`, then open **EC2 → Instances → Connect → Session Manager**. The role in the stack grants only the standard Session Manager managed policy.

If `RepositoryUrl` was supplied:

```bash
cd /opt/everafter
nano .env.production
make validate
make deploy
```

If it was omitted, upload/clone the project first, then run the same commands. Set `DOMAIN`, all Google credentials, `TOKEN_ENCRYPTION_KEY`, and `SESSION_SECRET` in `.env.production` before `make deploy`.

## 4. Configure OAuth after HTTPS is live

When `https://YOUR_DOMAIN/healthz` returns `200`, add this exact Google authorized redirect URI:

```text
https://YOUR_DOMAIN/auth/google/callback
```

Set the identical value as `GOOGLE_REDIRECT_URI` in `.env.production`, then run `make restart`.

## Bootstrap troubleshooting

Inside Session Manager:

```bash
sudo tail -n 200 /var/log/everafter-bootstrap.log
docker --version
docker compose version
```

CloudFormation owns the EC2 instance, EIP, security group, IAM role, optional Route 53 record, and its EBS volume. Deleting the stack removes all of them, including `/opt/everafter/data/everafter.sqlite3`; take a backup before deleting infrastructure if you need to keep any project data.
