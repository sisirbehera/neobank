# 0011. One Docker service on Render, with Atlas M0 in Singapore

- **Status:** Accepted
- **Date:** 2026-10-09

## Context

The app must be public and free to run, deploy from GitHub, and support MongoDB transactions ([0003](0003-mongodb-transactions.md)). Most users are in India.

## Decision

- **Render free web service**, built from the repo's multi-stage `Dockerfile` and described in `render.yaml` (a Blueprint), in **Singapore**. Express serves the API and the built Angular app from **one container and one URL**.
- **MongoDB Atlas M0** (free, a 3-node replica set) on **AWS Singapore**. The database sits next to the server, not the users: a page makes several database calls, so server-to-database latency matters more than user-to-server latency, which is paid once. Atlas has no free tier in Mumbai, and Render has no India region.
- Secrets: Render generates `JWT_ACCESS_SECRET` and `MFA_ENCRYPTION_KEY`; `MONGODB_URI` and `ADMIN_PASSWORD` are entered in the dashboard and never committed.
- Quality gates around it: CI builds and smoke-tests the Docker image on every push, and a weekly workflow smoke-tests the live app (which also keeps the Atlas cluster active).

## Alternatives considered

- **Vercel or Netlify for Angular + Render for the API:** two origins, so CORS and cross-site cookies (no `SameSite=Strict`).
- **Azure App Service F1 / Google Cloud Run:** good for learning those clouds; need more setup or a billing account.
- **AWS:** credit-based free plan for new accounts and a risk of surprise bills.
- **Heroku:** no free tier since 2022.

## Consequences

- Free, with automatic deploys on push and HTTPS included.
- The free service sleeps after 15 minutes idle; the first visit then takes 30–60 seconds.
- Atlas M0 has 512 MB and **no backups**, and Atlas allows network access from anywhere (`0.0.0.0/0`) because Render's free tier has no fixed outgoing IP. Acceptable for a demo, not for a real bank.
- The same Docker image can later move to another host with only environment changes.
