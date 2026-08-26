# FatSecret compliance follow-up

Status: **Deferred**  
Reviewed: 2026-08-25

Pocket Pace's FatSecret integration is optional and remains unchanged. Until the items below are addressed, the safest course is to leave **Settings -> Food Data -> FatSecret proxy URL** blank and continue using Open Food Facts and USDA.

This is a technical compliance checklist, not legal advice.

## Official policies reviewed

- [FatSecret Platform API Terms of Use](https://platform.fatsecret.com/terms)
- [FatSecret Attribution Policy](https://platform.fatsecret.com/attribution)
- [FatSecret OAuth 2.0 authentication](https://platform.fatsecret.com/docs/guides/authentication/oauth2)
- [FatSecret storable-data rules](https://platform.fatsecret.com/docs/guides/storable-data)

## Changes to make before enabling FatSecret

### 1. Add required attribution

- Use FatSecret's approved linked badge or attribution snippet, not only a plain `FatSecret` source label.
- Show attribution everywhere FatSecret-derived content is displayed, including:
  - barcode source selection;
  - recent, favorite, and search results;
  - the Log Food view;
  - logged meal rows and nutrition summaries that include FatSecret data.
- Add attribution to the public About/website page.
- If Pocket Pace is later listed in an app store, add the required attribution to the listing.
- Keep attribution associated with any retained FatSecret content even if the integration is later disabled.

Primary UI file: `src/features/nutrition/NutritionPage.tsx`.

### 2. Enforce the 24-hour storage rule

- Treat FatSecret food names, brands, ingredients, serving details, and nutrient values as expiring content.
- Use `lastFetchedAt` to refresh or remove non-storable FatSecret content within 24 hours.
- Retain indefinitely only fields FatSecret explicitly identifies as storable, such as applicable `food_id` and `serving_id` values.
- Do not use a locally cached FatSecret barcode result after it has expired without refreshing it.
- Remove non-storable FatSecret content from JSON backups.
- Add migration/cleanup logic for FatSecret records already older than 24 hours.

Primary persistence files:

- `src/db/repositories/nutritionRepository.ts`
- `src/services/backup/backupService.ts`
- `src/types/models.ts`

### 3. Resolve historical food-log storage

Pocket Pace currently saves permanent food-log snapshots containing a food name and calculated calories/macros. Ask FatSecret whether values derived from its API may be retained as part of a user's historical diary. If not, redesign FatSecret log entries to retain only permitted IDs and genuinely user-authored fields, then re-fetch displayable nutrition content when needed. A separate written agreement may be required if permanent historical snapshots are essential.

### 4. Add terms and privacy disclosures

- Add Pocket Pace application terms that link to the FatSecret API Terms.
- Include the required statement that users agree to the applicable FatSecret terms when using FatSecret-powered features.
- Add a privacy notice explaining Pocket Pace's local browser storage, optional proxy requests, backups, and deletion behavior.
- Ensure required legal/attribution information is accessible without login if accounts are added later.

### 5. Clarify nutrition-guidance use

Pocket Pace calculates calorie targets, deficits, and weight-loss projections independently of FatSecret, while FatSecret nutrition data may contribute to consumption totals. Ask FatSecret whether this combination is permitted under the restriction on using its API for diet, nutrition, or health advice. Retain the existing medical disclaimer, but do not assume the disclaimer alone resolves the restriction.

Primary goal UI: `src/features/settings/CalorieGoalSettings.tsx`.

### 6. Harden proxy usage

- Continue using the Cloudflare Worker; do not place the Client ID or Client Secret in the PWA.
- Ensure the FatSecret application registration accurately identifies Pocket Pace and its production domain.
- Keep the `barcode` scope approved and use the keys only for the registered application.
- Add Cloudflare rate limiting and monitoring to protect FatSecret's daily call allowance.
- Retain the exact-origin CORS allowlist, but do not treat CORS alone as abuse prevention.
- Add a way to disable FatSecret immediately if credentials, quota, or compliance status changes.

Primary proxy files:

- `fatsecret-proxy/src/index.js`
- `fatsecret-proxy/wrangler.jsonc`

## Current assessment

- **Attribution:** not sufficient when FatSecret is enabled.
- **Storage and backups:** not compliant with the published 24-hour rule when FatSecret is enabled.
- **Terms/privacy:** likely insufficient for use by anyone other than the owner.
- **Nutrition guidance:** requires clarification or written permission.
- **Proxy-based credential handling:** appropriate design.
- **General accessibility and user-triggered barcode calls:** no issue identified during this review.

Re-check the official policies before implementation because FatSecret may update its terms or documentation.
