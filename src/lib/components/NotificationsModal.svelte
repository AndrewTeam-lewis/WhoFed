<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { supabase } from '$lib/supabase';
    import { currentUser } from '$lib/stores/user';

    const dispatch = createEventDispatcher();

    interface PendingInvite {
        id: string;
        household_id: string;
        household_name: string;
        invited_by_name: string;
        invited_by_email: string;
        created_at: string;
    }

    let invites: PendingInvite[] = [];
    let loading = true;
    let actionLoading: string | null = null;

    loadInvites();

    async function loadInvites() {
        loading = true;
        try {
            const { data, error } = await supabase
                .from('household_invitations')
                .select(`
                    id,
                    household_id,
                    created_at,
                    households (name),
                    profiles!household_invitations_invited_by_fkey (first_name, last_name, email)
                `)
                .eq('status', 'pending')
                .order('created_at', { ascending: false });

            if (error) throw error;

            invites = (data || []).map((inv: any) => {
                const first = inv.profiles?.first_name || '';
                const last = inv.profiles?.last_name || '';
                const fullName = [first, last].filter(Boolean).join(' ') || 'Someone';
                return {
                    id: inv.id,
                    household_id: inv.household_id,
                    household_name: inv.households?.name || 'Unnamed Household',
                    invited_by_name: fullName,
                    invited_by_email: inv.profiles?.email || '',
                    created_at: inv.created_at
                };
            });
        } catch (e) {
            console.error('Error loading invites:', e);
        } finally {
            loading = false;
        }
    }

    async function acceptInvite(invite: PendingInvite) {
        if (!$currentUser) return;
        actionLoading = invite.id;

        try {
            const { data, error } = await supabase.rpc('accept_household_invite', {
                p_invite_id: invite.id
            });

            if (error) throw error;

            const result = data as { success: boolean; error?: string };
            if (!result.success) throw new Error(result.error || 'Failed to accept invite');

            // Remove from local list
            invites = invites.filter(i => i.id !== invite.id);

            // Reload the page to refresh household list
            window.location.reload();
        } catch (e: any) {
            console.error('Error accepting invite:', e);
            alert('Failed to accept invite: ' + e.message);
        } finally {
            actionLoading = null;
        }
    }

    async function declineInvite(invite: PendingInvite) {
        actionLoading = invite.id;

        try {
            const { error } = await supabase
                .from('household_invitations')
                .update({ status: 'declined' })
                .eq('id', invite.id);

            if (error) throw error;

            // Remove from local list
            invites = invites.filter(i => i.id !== invite.id);
        } catch (e: any) {
            console.error('Error declining invite:', e);
            alert('Failed to decline invite: ' + e.message);
        } finally {
            actionLoading = null;
        }
    }

    function timeAgo(dateStr: string): string {
        const diff = Date.now() - new Date(dateStr).getTime();
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return 'just now';
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }
</script>

<div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
    <!-- Backdrop -->
    <button type="button" class="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" on:click={() => dispatch('close')}></button>

    <!-- Modal -->
    <div class="bg-white rounded-[32px] w-full max-w-sm relative z-10 animate-scale-in max-h-[85vh] overflow-y-auto">
        <div class="p-6">
            <!-- Header -->
            <div class="flex items-center justify-between mb-6">
                <h3 class="text-xl font-bold text-gray-900">Notifications</h3>
                <button on:click={() => dispatch('close')} class="text-gray-400 hover:text-gray-600">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {#if loading}
                <div class="flex items-center justify-center py-12">
                    <svg class="animate-spin h-6 w-6 text-gray-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                </div>
            {:else if invites.length === 0}
                <div class="text-center py-12">
                    <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                    </div>
                    <p class="text-gray-400 text-sm font-medium">No notifications</p>
                    <p class="text-gray-300 text-xs mt-1">You're all caught up!</p>
                </div>
            {:else}
                <div class="space-y-3">
                    {#each invites as invite (invite.id)}
                        <div class="bg-gray-50 rounded-xl p-4">
                            <div class="flex items-start space-x-3">
                                <div class="w-10 h-10 bg-brand-sage/10 rounded-full flex items-center justify-center flex-shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-brand-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                    </svg>
                                </div>
                                <div class="flex-1 min-w-0">
                                    <p class="text-sm font-medium text-gray-900">
                                        Household Invite
                                    </p>
                                    <p class="text-xs text-gray-500 mt-0.5">
                                        <span class="font-semibold">{invite.invited_by_name}</span> invited you to join <span class="font-semibold">{invite.household_name}</span>
                                    </p>
                                    {#if invite.invited_by_email}
                                        <p class="text-[10px] text-gray-400 mt-0.5">{invite.invited_by_email}</p>
                                    {/if}
                                    <p class="text-[10px] text-gray-400 mt-0.5">{timeAgo(invite.created_at)}</p>
                                </div>
                            </div>
                            <div class="flex space-x-2 mt-3">
                                <button
                                    class="flex-1 py-2 bg-gray-200 text-gray-600 rounded-lg font-semibold text-xs hover:bg-gray-300 transition-colors disabled:opacity-50"
                                    on:click={() => declineInvite(invite)}
                                    disabled={actionLoading === invite.id}
                                >
                                    Decline
                                </button>
                                <button
                                    class="flex-1 py-2 bg-brand-sage text-white rounded-lg font-semibold text-xs hover:bg-brand-sage/90 transition-colors disabled:opacity-50"
                                    on:click={() => acceptInvite(invite)}
                                    disabled={actionLoading === invite.id}
                                >
                                    Accept
                                </button>
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    </div>
</div>
