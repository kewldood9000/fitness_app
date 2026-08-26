# Pocket Pace FatSecret proxy

FatSecret requires OAuth 2.0 client credentials and explicitly requires access tokens to be requested through a proxy server. This Cloudflare Worker keeps the Client Secret out of the public GitHub Pages JavaScript bundle.

## Deploy

1. Register an application in the [FatSecret Platform](https://platform.fatsecret.com/) and obtain access to the `barcode` scope.
2. Update `ALLOWED_ORIGINS` in `wrangler.jsonc` to the exact Pocket Pace production origin. Keep the local Vite origin only if you want local testing.
3. From this directory, install dependencies and save both credentials as encrypted Worker secrets:

   ```bash
   npm install
   npx wrangler secret put FATSECRET_CLIENT_ID
   npx wrangler secret put FATSECRET_CLIENT_SECRET
   npm run deploy
   ```

4. Copy the deployed `https://...workers.dev` URL into Pocket Pace under **Settings → Food Data → FatSecret proxy URL**.

Never place either FatSecret credential in the PWA `.env`, source code, GitHub repository, or browser settings.
