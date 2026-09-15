# RECAP4NDC WebApp — Project Guide

## Repository Layout

- `Web/` — React 19 + Vite frontend
- `api/` — Node.js 22 + Express + Sequelize backend
- `api/routers/` — Express route handlers
- `api/utils/` — Shared backend utilities (accessScope.js, auditLogger, etc.)
- `api/middlewares/` — JWT verification, caching, sanitization
- `api/config/` — Database (Sequelize) and environment configuration

## Key Verification Commands

```bash
# Backend syntax check
cd api && node -c routers/patrolRoutes.js

# Backend regression tests (access scope, dedup, hierarchy)
cd api && npx mocha regression.test.js --timeout 30000

# Frontend production build
cd Web && npx vite build
```

## Architecture Notes

### Access Control

- All protected APIs derive access scope from `req.user` (set by `verifyJwt`).
- Shared helper: `api/utils/accessScope.js` — `getAccessScope`, `appendAccessConditions`, `canAccessRecord`, `formatPatrolCode`.
- Global roles (admin, HOFF, PCCF, APCCF, CCF, CF, circle-level) get unrestricted area scope.
- Scoped roles: Beat Guard → own records; RFO → range; DCF/DFO → division; Round Officer/Forester → round.
- User-supplied division/range/round/beat filters narrow scope, never expand it.
- SQL comparisons normalize case, whitespace, underscores, and hyphens.

### Database

- Single Sequelize connection pool (no separate pg.Pool).
- Statement timeout: 30s. Pool acquire timeout: 60s. Connect timeout: 10s.
- Patrol routes use a Sequelize-backed adapter (`client.query`) with acquire retries.

### Frontend API Client

- `Web/utils/apiClient.js` — centralized Axios instance with 30s timeout, 2 retries, GET deduplication, auto-logout on 401.
- `Web/utils/authUtils.js` — hierarchy helpers (`getUserDivision`, `matchesUserHierarchy`, etc.).
- `fetchWithTimeout` export wraps `window.fetch` with timeout and 401 handling.

### NDVI Dashboard

- Date picker min date: 2025-01-01.
- All Divisions: max 3-month range (monthsDiff <= 2).
- Single division: max 12-month range (monthsDiff <= 11).
- Multi-month data stored per-month in `monthlyData`; month selector switches table view.

### Notifications

- Backend sanitizes `change_count` to strip non-numeric suffixes (e.g. "9193V" → 9193).
- Default date range: 12 months historical (matches NDVI dashboard).
- Server-side pagination: default 500, max 2000 per page.

## Production Deployment

- Frontend: `cd Web && npm run build` → deploy `Web/dist/` to `/var/www/recap4ndc/dist`
- Backend: PM2 cluster (`api/ecosystem.config.cjs`) on port 5002
- Nginx proxies `/api/` → backend, `/geoserver/` → GeoServer, `/forest-proxy/` → Gujarat Forest Service
- **Always obtain explicit confirmation before deploying to production.**
