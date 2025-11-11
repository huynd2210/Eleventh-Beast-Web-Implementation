An Implementation of the Solo-RPG game "Eleventh Beast" by Exeunt Press

Eleventh Beast itch-io link: https://exeuntpress.itch.io/eleventh-beast.

## Deploying to Render

This project ships with a `render.yaml` blueprint so you can stand up the entire stack on [Render](https://render.com) with one click.

### 1. Fork and push

Render deployments run from Git repositories. Fork this repo (or push it to a repo you control) so Render can pull the code.

### 2. Create a Blueprint instance

1. Log in to Render.
2. Navigate to **Blueprints** and click **New Blueprint Instance**.
3. Point Render at your forked repository.
4. Accept the defaults shown for the `eleventh-beast-web` service and press **Apply**.

The blueprint provisions:

- A Node 20 web service that runs `npm install --legacy-peer-deps && npm run build` during the build phase and launches `npm run start` in production.
- A persistent disk mounted at `/opt/render/project/src/data` so the `data/profile.json` file (player profiles and run journals) survives deploys and restarts.

### 3. First boot checklist

- Render automatically sets the following environment variables from the blueprint:
  - `NODE_VERSION=20.11.1`
  - `NPM_CONFIG_LEGACY_PEER_DEPS=true`
  - `NEXT_TELEMETRY_DISABLED=1`
- The disk is created empty. On first run the app will generate `data/profile.json` automatically — no manual seeding required.

Once the build completes, Render will expose a public URL for your deployment. Any subsequent push to the repo triggers a rebuild; you can disable auto-deploys in Render if you prefer to promote manually.
