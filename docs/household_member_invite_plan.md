# Plan: Enhanced Household Member Invite Flow

## Goal Description
Enhance the "Add Member" experience in the Settings page to allow adding users to a household via:
1.  **Scanning a QR Code** (Existing but needs polish).
2.  **Sharing a Link** (Existing but needs polish).
3.  **Direct Username Invite with Approval Flow** (New feature).

The goal is to provide a seamless modal experience triggered from the household list that covers all these methods, while ensuring user privacy and consent through an approval mechanism.

## User Review Required
> [!IMPORTANT]
> **Invite Approval Flow**:
> To prevent spam/random adds, when User A invites User B by username:
> 1. User B receives an in-app **Notification**.
> 2. The household does *not* appear in User B's list immediately.
> 3. User B must **Accept** the invite to join.
>
> **Database Changes**:
> - We need a `household_invitations` table (or similar) to store pending invites.
> - We might need a `notifications` table if one doesn't exist, to show the "You have an invite" alert.

## Proposed Changes

### Database Schema

#### [NEW] [supabase/migrations/202602XX_add_invitations.sql](file:///Users/Andrew/Code/WhoFed/supabase/migrations/202602XX_add_invitations.sql)
-   **Create table `household_invitations`**:
    -   `id` (uuid, pk)
    -   `household_id` (fk to households)
    -   `invited_user_id` (fk to profiles, nullable if email pending?) -> *Decision: For username invite, we resolve to user_id immediately. If we want to support email invites for non-users later, we'd need email column. For now, strict username match.*
    -   `invited_by` (fk to profiles)
    -   `status` (enum: 'pending', 'accepted', 'declined')
    -   `created_at`
-   **RLS Policies**:
    -   Users can view invites where they are `invited_user_id`.
    -   Household owners can view invites for their household.

#### [NEW] Backend Function (RPC)
-   `invite_user_by_username(p_username text, p_household_id uuid)`:
    -   Find user profile by `username` (case-insensitive).
    -   If found, insert into `household_invitations`.
    -   Return success/error (e.g., "User not found").

### UI Components

#### [MODIFY] [settings/+page.svelte](file:///Users/Andrew/Code/WhoFed/src/routes/settings/+page.svelte)
-   **Notifications Section**: 
    -   This already exists in the UI (bell icon). We should enhance this to show a "badge" if there are pending invites.
    -   Clicking Notifications should open a modal or view listing pending invites.
-   **Invite Modal**: Refactor out to new component.

#### [NEW] [src/lib/components/InviteMemberModal.svelte](file:///Users/Andrew/Code/WhoFed/src/lib/components/InviteMemberModal.svelte)
-   **Tabs/layout**:
    -   **Tab 1: Share Link/QR**: Show QR and Share Button.
    -   **Tab 2: Invite by Username**:
        -   Input: "Enter Username" (with `@` prefix helper).
        -   Action: "Send Invite".
        -   Feedback: "Invite sent to @username" or "User not found".

#### [NEW] [src/lib/components/NotificationsModal.svelte](file:///Users/Andrew/Code/WhoFed/src/lib/components/NotificationsModal.svelte)
-   List pending invitations.
-   **Actions**: "Accept" (joins household), "Decline" (updates status/deletes invite).

## Verification Plan

### Manual Verification
1.  **User A (Owner)**:
    -   Go to Settings -> "Invite".
    -   Enter User B's username.
    -   Click Send. Verify success message.
2.  **User B (Invitee)**:
    -   Login.
    -   See notification badge in Settings.
    -   Open Notifications.
    -   See "Invite to [Household Name] from [User A]".
    -   **Test Decline**: Click Decline -> Item disappears, verify NOT in household list.
    -   **Test Accept**: (Repeat invite first) Click Accept -> Verify household appears in list immediately.
3.  **Invalid Username**: Try to invite "nonexistent_user_123", should show error.
