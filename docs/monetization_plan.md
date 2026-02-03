# Monetization Strategy & Implementation Plan

## Goal
Implement a robust "Freemium" monetization model that balances revenue generation with viral growth. The strategy shifts from the current "Premium Household" placeholder to a "Premium User" model, ensuring that specific limits (like multiple household membership) are tied to the user's tier.

## Strategic Analysis & Validation

### Current State vs. Requirements
- **Current Code**: Implements a "Premium Household" model (`households.subscription_status`). Using this model means if the Owner pays, everyone benefits.
- **Requirements Strategy**: "A **person** should be either a free or premium member." This implies a User-level subscription.
    - *Premium Benefits*: Photos, >2 pets, **multiple households**, data export.
- **The Friction Point**: limiting Free users to 1 household.
    - *Scenario*: User A (Free, has own dog) invites User B (Free, has own dog) to pet sit.
    - *Conflict*: User B is already in 1 household. If limit is hard (1 household max), User B determines they cannot join without paying. This creates **High Friction**.
    - *Proposed Resolution*:
        - **Free Tier**: Can **OWN** 1 Household. Can **JOIN** Unlimited Households (as a non-owner member).
        - **Premium Tier**: Can **OWN** Unlimited Households.
        - *Why*: This preserves the "Pet Sitter" flow (frictionless joining) but limits the "Power User" flow (managing multiple personal households).

## User Review Required
> [!IMPORTANT]
> **Data Model Change**: We will move `subscription_status` from `households` table to `profiles` table to support User-Level tiers.

> [!WARNING]
> **Logic Change**: The "Multiple Households" limit will be interpreted as "Multiple Owned Households" for Free users to prevent blocking viral sharing (e.g., pet sitters). **Please confirm if you strictly want to limit *membership* instead.**

## Proposed Changes

### Database Schema
#### [MODIFY] `supabase/migrations/*`
- Add `tier` (enum: 'free', 'premium') to `profiles` table.
- Update RLS policies to allow reading `tier` for appropriate users.

### Application Logic

#### [MODIFY] `src/lib/types.ts` & `src/stores/appState.ts`
- Update User/Profile types to include `tier`.
- Create a derived store `isPremiumUser` based on the current user's profile.

#### [MODIFY] `src/routes/settings/+page.svelte`
- **Toggle Fix**: Update the "Dev Toggle" to update `profiles.tier` instead of `households.subscription_status`.
- **Feature Gating**:
    - **Export Data**: Check `user.tier === 'premium'`.
    - **Pet Photos**: Check `user.tier === 'premium'` before allowing upload.
- **Display**: Update UI to show User Tier status, not Household status.

#### [MODIFY] `src/routes/+layout.svelte` / Global Gates
- **Pet Creation**: In `src/routes/pets/add/+page.svelte` (or similar), check if `user.owned_pets_count >= 2` and `user.tier === 'free'`.
- **Household Creation**: Check if `user.owned_households_count >= 1` and `user.tier === 'free'`.

## Verification Plan

### Automated/Manual Tests
1.  **Dev Toggle**:
    - Click "Toggle Premium" in Settings. verified that `profiles.tier` updates in DB.
    - Refresh page, ensure UI reflects Premium status.
2.  **Pet Limits**:
    - As Free User: Create 2 pets. Try to create 3rd -> Verify Blocked.
    - Upgrade to Premium. Try to create 3rd -> Verify Allowed.
3.  **Household Limits**:
    - As Free User: Own 1 household. Try to create 2nd -> Verify Blocked.
    - Join another household (via invite link) -> Verify Allowed (Viral check).
4.  **Export Data**:
    - As Free User: Click Export -> Verify Upsell Modal.
    - As Premium User: Click Export -> Verify PDF generation.
