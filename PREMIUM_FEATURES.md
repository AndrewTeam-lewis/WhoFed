# WhoFed Premium vs Free Features

This document outlines the feature differences between Free and Premium tiers in the WhoFed application, based on the codebase implementation.

## Premium Status Detection

Premium status is determined by **either** of the following:

1. **Database Tier**: User's `tier` field in the `profiles` table is set to `'premium'` (for web subscriptions)
2. **Native IAP**: RevenueCat entitlement check returns `true` (for mobile app purchases)

**Implementation:** `src/lib/stores/user.ts`
```typescript
export const userIsPremium = derived(
    [userTier, nativePremiumStatus],
    ([$tier, $native]) => $tier === 'premium' || $native
);
```

---

## Feature Comparison

### 🐾 Pets per Household

| Feature | Free | Premium |
|---------|------|---------|
| **Max Pets** | **2 pets** per household | **Unlimited** |
| **Enforcement** | Hard limit - shows premium modal when attempting to add 3rd pet | No restrictions |

**Implementation:** `src/routes/app/+page.svelte` (line 364)
```typescript
if (!$userIsPremium && pets.length >= 2) {
    showPremiumModal = true;
}
```

**Also enforced in:** `src/routes/pets/add/+page.svelte` (line 106, 242)

---

### 🏠 Owned Households

| Feature | Free | Premium |
|---------|------|---------|
| **Max Owned** | **1 household** (as owner) | **Unlimited** |
| **Membership** | Can be **member** of unlimited households | Can be member of unlimited households |
| **Enforcement** | Blocks creation of 2nd owned household | No restrictions |

**Implementation:** `src/routes/app/+page.svelte` (line 137)
```typescript
if (!$userIsPremium) {
    const ownedCount = $availableHouseholds.filter(h => h.role === 'owner').length;
    if (ownedCount >= 1) {
        showPremiumModal = true;
        return;
    }
}
```

**Note:** New households are created with `subscription_status: 'free'` by default

---

### 📸 Custom Pet Photos

| Feature | Free | Premium |
|---------|------|---------|
| **Pet Icons** | **Stock emoji icons only** (🐶, 🐱, etc.) | Stock icons **+ custom photo uploads** |
| **Enforcement** | Shows "PREMIUM" badge on upload button, triggers premium modal | Full access to photo upload |

**Implementation:** `src/routes/pets/add/+page.svelte` (line 584)
```typescript
if ($userIsPremium) {
    showPhotoSourceModal = true;
} else {
    showPremiumModal = true;
}
```

---

### 📊 Activity History

| Feature | Free | Premium |
|---------|------|---------|
| **History Access** | **Limited** medication and feeding history | **Unlimited** medication and feeding history |
| **Use Case** | Basic tracking | Full vet-ready historical records |

**Implementation:** Based on translation strings in `src/lib/i18n/en.ts` (line 381-383):
```typescript
unlock_title: 'Unlock Full History',
unlock_desc: 'Upgrade to Premium to see unlimited medication and feeding history. Great for vet visits!',
```

---

### 👥 Household Members

| Feature | Free | Premium |
|---------|------|---------|
| **Max Members** | **Limited** (specific limit not found in current code) | **Unlimited** |
| **Enforcement** | Shows "Member Limit Reached" message | No restrictions |

**Implementation:** Based on translation string in `src/lib/i18n/en.ts` (line 80):
```typescript
member_limit_reached: 'Member Limit Reached',
```

---

## Household Roles: Owner vs Member

Every user in a household has one of two roles: **Owner** or **Member**. Additionally, members have granular permissions (`can_log`, `can_edit`) that control their access.

### Owner Permissions

Owners have **full control** over the household:

| Permission | Owner Access |
|------------|--------------|
| **Add Pets** | ✅ Yes |
| **Delete Pets** | ✅ Yes |
| **Edit Pet Settings** | ✅ Yes (always) |
| **Log Tasks** | ✅ Yes (always) |
| **Invite Members** | ✅ Yes |
| **Remove Members** | ✅ Yes |
| **Toggle Member Permissions** | ✅ Yes (can_log, can_edit) |
| **Rename Household** | ✅ Yes |
| **Delete Household** | ✅ Yes |

**Implementation:**
- Floating "Add Pet" button only shows for owners: `src/routes/app/+page.svelte:1091`
- Pet deletion option only shows for owners: `src/routes/app/+page.svelte:1027`
- Member management only available to owners: `src/routes/settings/+page.svelte:943,978,1006,1028`
- Owners always have `can_log: true` and `can_edit: true` when created

### Member Permissions

Members have **limited access** controlled by permission flags:

| Permission | Member Access | Controlled By |
|------------|---------------|---------------|
| **View Pets** | ✅ Yes (always) | - |
| **Log Tasks** | ⚙️ Configurable | `can_log` boolean |
| **Edit Pet Settings** | ⚙️ Configurable | `can_edit` boolean |
| **Add Pets** | ❌ No | - |
| **Delete Pets** | ❌ No | - |
| **Invite Members** | ❌ No | - |
| **Remove Members** | ❌ No | - |
| **Manage Permissions** | ❌ No | - |
| **Delete Household** | ❌ No | - |

**Default Member Permissions:**
When a new member joins a household, they are created with:
```typescript
can_log: true,    // Can log tasks by default
can_edit: true    // Can edit settings by default
```

**Implementation:** `src/routes/app/+page.svelte:167-168`

### Permission Management

**Only owners** can toggle member permissions:

```typescript
async function togglePermission(userId: string, permission: 'can_log' | 'can_edit') {
    if (!isOwner) return; // Only owner can change permissions
    // ... toggle logic
}
```

**Implementation:** `src/routes/settings/+page.svelte:471`

### Role Determination

- **Owner**: Determined by `households.owner_id` matching the user's ID
- **Member**: All other users in `household_members` table
- The `role` field is **derived** from ownership, not stored separately

### UI Indicators

**Household Switcher:**
- Owners see: Green badge with "Owner" label
- Members see: Gray badge with "Member" label

**Implementation:** `src/routes/app/+page.svelte:894-895`

**Settings Page:**
- Owners see: "Owner" in green text with edit controls
- Members see: "Member of [Owner Name]" in gray text

**Implementation:** `src/routes/settings/+page.svelte:926-927`

---

## Premium Upsell Modal

When users hit a free tier limitation, they see a premium upsell modal with:

- **Visual**: Diamond icon (💎) on gradient background
- **Message**: "You've reached the limit of the Free plan"
- **Features**: "Unlock unlimited pets, members & history!"
- **CTA**: "Check Pricing" button

**Implementation:** `src/routes/app/+page.svelte` (lines 1104-1149)

---

## Summary Tables

### Premium vs Free Features

| Feature | Free Tier | Premium Tier |
|---------|-----------|--------------|
| **Pets per Household** | 2 | Unlimited |
| **Owned Households** | 1 | Unlimited |
| **Household Membership** | Unlimited | Unlimited |
| **Pet Photos** | Stock icons only | Custom uploads |
| **Activity History** | Limited | Unlimited |
| **Household Members** | Limited | Unlimited |

### Owner vs Member Permissions

| Permission | Owner | Member (default) |
|------------|-------|------------------|
| **Add/Delete Pets** | ✅ Yes | ❌ No |
| **Log Tasks** | ✅ Yes | ✅ Yes (toggleable) |
| **Edit Pet Settings** | ✅ Yes | ✅ Yes (toggleable) |
| **Manage Members** | ✅ Yes | ❌ No |
| **Delete Household** | ✅ Yes | ❌ No |

---

## Code Locations Reference

### Premium Features
- **Premium Status Logic**: `src/lib/stores/user.ts`
- **Pet Limit Checks**:
  - `src/routes/app/+page.svelte:364`
  - `src/routes/pets/add/+page.svelte:106,242`
- **Household Limit Check**: `src/routes/app/+page.svelte:137`
- **Photo Upload Limit**: `src/routes/pets/add/+page.svelte:584`
- **Premium Upsell Modal**: `src/routes/app/+page.svelte:1104`

### Owner vs Member Permissions
- **Owner-Only Add Pet Button**: `src/routes/app/+page.svelte:1091`
- **Owner-Only Delete Pet**: `src/routes/app/+page.svelte:1027`
- **Owner-Only Member Management**: `src/routes/settings/+page.svelte:943,978,1006,1028`
- **Permission Toggle Function**: `src/routes/settings/+page.svelte:471`
- **Default Member Permissions**: `src/routes/app/+page.svelte:167-168`
- **Role Badge Display**: `src/routes/app/+page.svelte:894-895`
- **Database Schema**: `src/lib/database.types.ts:205-206` (can_log, can_edit)

### Translation Strings
- **Premium Features**: `src/lib/i18n/en.ts`

---

## Implementation Notes

### Premium Features
1. **Subscription Status Field**: Households have a `subscription_status` field that defaults to `'free'` when created
2. **Dual Premium Sources**: Premium status can come from either web (database) or mobile (RevenueCat)
3. **Hard vs Soft Limits**: All limits are hard-enforced (block action + show modal) rather than soft warnings
4. **Member-Only Access**: Users can be members of unlimited households regardless of tier, but can only own 1 household on free tier

### Household Roles
1. **Role Determination**: Owner role is determined by matching `households.owner_id` to user ID, not stored separately
2. **Permission Granularity**: Members have two toggleable permissions: `can_log` and `can_edit`
3. **Default Permissions**: New members are created with both `can_log: true` and `can_edit: true` by default
4. **Owner Permissions**: Owners implicitly have both `can_log` and `can_edit` set to true and cannot be changed
5. **Permission Management**: Only household owners can toggle member permissions
6. **UI Enforcement**: Permission checks happen in the UI layer - owners see different buttons/options than members

---

*Last Updated: 2025-03-04*
