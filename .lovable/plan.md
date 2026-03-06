

# Fix: Auth redirect loop

## Problem

Two issues creating a redirect loop:

1. **Auth.tsx line 25**: After successful login, redirects to `/` (landing page) instead of `/dashboard`
2. **LandingPage** (`/`): Doesn't check if user is already logged in to redirect to `/dashboard`

Flow: User logs in → Auth sends to `/` → Landing page shows again (loop).

## Fix

### 1. `src/pages/Auth.tsx`
Change line 25: `<Navigate to="/" replace />` → `<Navigate to="/dashboard" replace />`

### 2. `src/pages/LandingPage.tsx`
Add auth check at the top: if user is logged in, `<Navigate to="/dashboard" replace />`. Show loading spinner while auth is initializing.

### 3. `src/components/landing/LandingHero.tsx` and `src/components/landing/LandingFooter.tsx`
Update CTA buttons that navigate to `/auth` — keep them pointing to `/auth` (this is correct).

These are the only two changes needed. No routing changes required.

