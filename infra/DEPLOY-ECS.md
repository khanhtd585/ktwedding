# Deploy Everafter on Amazon ECS (Fargate)

## Important prerequisite

An ECS public IP is useful only for an app-only smoke test. Real Google OAuth requires a stable HTTPS redirect URL, so production needs a domain such as `photos.example.com` and `https://photos.example.com/auth/google/callback` configured in both Google Cloud and `GOOGLE_REDIRECT_URI`. A raw public IP over HTTP cannot be used as the production OAuth callback.

## 1. Create infrastructure

1. Create an ECR repository for `everafter-app` and one for `everafter-traefik`.
2. Create an EFS file system and access point. Configure the access point POSIX user/group as `10001` and its root directory as `/everafter`.
3. Create CloudWatch log group `/ecs/everafter`.
4. Create four Secrets Manager secret values: Google client ID, Google client secret, Fernet encryption key, and session secret.
5. Ensure the ECS task role can mount the EFS access point and the execution role can read the named Secrets Manager values.

## 2. Build and publish images

```powershell
docker build -t everafter-app:latest .
docker build -f ./traefik/Dockerfile.ecs -t everafter-traefik:latest ./traefik
```

Tag each image for its ECR repository and push it. Replace every placeholder in `ecs-task-definition.json`: account, region, image tag, EFS file system, EFS access point, and secret ARNs.

## 3. Register task and create service

Register the edited task definition. Create a one-task ECS service in private subnets with the EFS mount target reachable. Place an internet-facing Application Load Balancer in public subnets and forward HTTPS `443` to container `traefik:80`.

Use an ACM certificate for the public domain. Set the security group so only the ALB can reach ECS port 80; the ALB accepts 443 from the internet. Do not expose the application container port 8000.

## 4. Configure Google Cloud

Create OAuth credentials of type **Web application** and add this exact authorized redirect URI:

```text
https://photos.example.com/auth/google/callback
```

Set the same URL in `GOOGLE_REDIRECT_URI`. The owner signs in, creates a project, and enters a Google Drive folder URL. Everafter imports metadata for direct image children only and keeps originals in Drive.

## 5. Verify

```text
GET https://photos.example.com/healthz
```

Expected response: `{"status":"ok"}`.

For a single SQLite writer, run exactly one application task. Scaling to multiple app tasks requires moving data to a shared transactional database such as RDS PostgreSQL; EFS preserves the SQLite file but does not make multi-writer SQLite safe.

## Optional: direct public-IP smoke test

Create the ECS service in a **public subnet**, enable **Assign public IP**, and attach a security group allowing inbound TCP `80` from your own IP address. Do not expose port `8000`; only `traefik:80` is mapped. The task's public IPv4 can then be opened at `http://<TASK_PUBLIC_IP>/healthz`.

This mode is not suitable for Google sign-in. Use it only to check that the container, EFS mount, and proxy are running before putting the service behind an HTTPS load balancer and domain.
