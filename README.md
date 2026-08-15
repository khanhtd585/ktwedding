# Everafter MVP

Run locally:

```powershell
python -m uvicorn app:app --reload --port 8000
```

Open `http://127.0.0.1:8000`. The app starts with an onboarding UI for Google sign-in and Google Drive folder permission, then local demo users and seeded photo metadata.

## Google production configuration

The current onboarding is intentionally a UI demo. To make the Google actions real, create a Google OAuth Web Application and provide these server-side environment variables:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI` (for example, `https://your-domain.com/auth/google/callback`)
- `TOKEN_ENCRYPTION_KEY`

The production OAuth scope should be restricted to Drive read access for the folder selected by the owner. Refresh tokens must be encrypted before being stored. The app should never modify, move, or delete photos in Drive.

## Test real Google login locally

1. In Google Cloud, enable **Google Drive API** and create an OAuth client of type **Web application**.
2. Add `http://localhost:8000/auth/google/callback` as an authorized redirect URI for local development.
3. Create an API key for Google Picker, restrict it to the Google Picker API, and add `http://localhost:8000` as an allowed referrer.
4. Copy `.env.example` to `.env`, fill in all Google values, set `GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback`, set a Fernet key and `SESSION_SECRET`, then set `DEMO_MODE=false`.
5. Export the variables and run `python -m uvicorn app:app --host 127.0.0.1 --port 8000`.

After Google login, create a project, click **Choose from Google Drive**, select a folder, then connect it. The app lists image files directly inside that folder and supports pagination beyond 1,000 files.

## Containers and ECS

`Dockerfile` and `traefik/` provide the application and proxy images for ECS. `infra/ecs-task-definition.json` is an ECS Fargate template that persists SQLite on EFS and exposes only Traefik on port 80.

Follow [infra/DEPLOY-ECS.md](infra/DEPLOY-ECS.md) to publish the two images, configure EFS/Secrets Manager, register the task, and use HTTPS with a real domain for Google OAuth.

## Recommended MVP deployment: one EC2 instance

For this SQLite-based MVP, use one EC2 instance with Docker Compose and Caddy instead of ECS. The production compose file stores the database on the EC2 disk and Caddy provisions HTTPS automatically. Follow [infra/DEPLOY-EC2.md](infra/DEPLOY-EC2.md).

For faster AWS infrastructure creation, use the included [CloudFormation guide](infra/DEPLOY-CLOUDFORMATION.md).

For the complete start-to-finish EC2, DNS, Google OAuth, validation, and operations procedure, follow [DEPLOY-PRODUCTION.md](DEPLOY-PRODUCTION.md).
