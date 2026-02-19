<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import { supabase } from '$lib/supabase';
    import { currentUser } from '$lib/stores/user';
    import QRCode from 'qrcode';
    import { t } from '$lib/services/i18n';

    export let householdId: string;
    export let canInvite: boolean;

    const dispatch = createEventDispatcher();

    let activeTab: 'link' | 'email' = 'link';

    // Share Link / QR state
    let qrCodeDataUrl = '';
    let inviteUrl = '';
    let linkLoading = true;

    // Username/email invite state
    let identifierInput = '';
    let inviteStatus: 'idle' | 'sending' | 'success' | 'error' = 'idle';
    let inviteMessage = '';

    // Suggestions State
    let suggestedUsers: any[] = [];
    let loadingSuggestions = false;

    $: isEmail = identifierInput.includes('@') && identifierInput.includes('.');

    // Generate invite link + QR on mount
    onMount(() => {
        generateInviteLink();
        if (canInvite) {
            loadSuggestions();
        }
    });

    async function loadSuggestions() {
        loadingSuggestions = true;
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // 1. Get IDs of households I own
            const { data: myHouseholds } = await supabase
                .from('households')
                .select('id')
                .eq('owner_id', user.id);
            
            if (!myHouseholds || myHouseholds.length === 0) return;

            const myHouseholdIds = myHouseholds.map(h => h.id);

            // 2. Get members of those households (potential suggestions)
            const { data: allMembers } = await supabase
                .from('household_members')
                .select('user_id, profiles(first_name, email)')
                .in('household_id', myHouseholdIds);

            // 3. Get members of THIS household (to exclude)
            const { data: currentMembers } = await supabase
                .from('household_members')
                .select('user_id')
                .eq('household_id', householdId);

            const currentMemberIds = new Set((currentMembers || []).map(m => m.user_id));
            currentMemberIds.add(user.id); // Exclude self

            // 4. Filter & Dedupe
            const uniqueMap = new Map();
            (allMembers || []).forEach((m: any) => {
                if (!currentMemberIds.has(m.user_id) && m.profiles) {
                    uniqueMap.set(m.user_id, m.profiles);
                }
            });

            suggestedUsers = Array.from(uniqueMap.values());

        } catch (e) {
            console.error('Error loading suggestions', e);
        } finally {
            loadingSuggestions = false;
        }
    }

    async function generateInviteLink() {
        linkLoading = true;
        try {
            // Check if key exists
            const { data: existingKey } = await supabase
                .from('household_keys')
                .select('key_value')
                .eq('household_id', householdId)
                .maybeSingle();

            let inviteKey = existingKey?.key_value;

            if (!inviteKey) {
                // Create new key
                inviteKey = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
                const { error: createError } = await supabase
                    .from('household_keys')
                    .insert({
                        household_id: householdId,
                        key_value: inviteKey,
                        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
                    });
                if (createError) throw createError;
            }

            const baseUrl = window.location.origin;
            inviteUrl = `${baseUrl}/join/?k=${inviteKey}`;
            qrCodeDataUrl = await QRCode.toDataURL(inviteUrl, {
                width: 256,
                margin: 2,
                color: {
                    dark: '#2f4f4f',
                    light: '#ffffff'
                }
            });
        } catch (e) {
            console.error('Error generating invite link:', e);
        } finally {
            linkLoading = false;
        }
    }

    async function handleShare() {
        if (!inviteUrl) return;

        const shareData = {
            title: $t.invite.title,
            text: $t.invite.scan_text,
            url: inviteUrl
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                await navigator.clipboard.writeText(inviteUrl);
                alert($t.common.success);
            }
        } catch (err) {
            console.error('Error sharing:', err);
        }
    }

    async function sendInvite() {
        const identifier = identifierInput.trim().replace(/^@/, '');
        if (!identifier) return;

        inviteStatus = 'sending';
        inviteMessage = '';

        try {
            const { data, error } = await supabase.rpc('invite_user_by_identifier', {
                p_identifier: identifier,
                p_household_id: householdId
            });

            if (error) throw error;

            const result = data as { success: boolean; error?: string };

            if (result.success) {
                inviteStatus = 'success';
                inviteMessage = $t.invite.sent_success.replace('{name}', identifier);
                identifierInput = '';

                // NEW: Send Push Notification
                const invitedUserId = (result as any).invited_user_id;
                if (invitedUserId) {
                    try {
                        const senderName = $currentUser?.first_name || 'Someone';
                        // We need the household name. It's not passed as a prop, but we can try to find it or just say "a household"
                        // Or pass it in. For now, generic message or passed prop? 
                        // The modal doesn't have householdName prop. We'll use a generic message or fetch it?
                        // Actually, let's just say "their household". 
                        // Better: We can pass householdName as a prop to this modal.
                        // For now, let's just trigger it.
                        supabase.functions.invoke('send-push', {
                            body: {
                                user_id: invitedUserId,
                                title: $t.invite.push_title,
                                body: $t.invite.push_body.replace('{name}', senderName),
                                url: '/settings'
                            }
                        }).then(({ error }) => {
                            if (error) console.error('Failed to send push:', error);
                        });
                    } catch (err) {
                        console.error('Error triggering push:', err);
                    }
                }
            } else {
                inviteStatus = 'error';
                inviteMessage = result.error || $t.invite.send_error;
            }
        } catch (e: any) {
            console.error('Error sending invite:', e);
            inviteStatus = 'error';
            inviteMessage = e.message || $t.invite.send_error;
        }
    }
</script>

<div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
    <!-- Backdrop -->
    <button type="button" class="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" on:click={() => dispatch('close')}></button>

    <!-- Modal -->
    <div class="bg-white rounded-[32px] w-full max-w-sm relative z-10 animate-scale-in max-h-[85vh] overflow-y-auto">
        <div class="p-6">
            <!-- Header -->
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-xl font-bold text-gray-900">{$t.invite.title}</h3>
                <button on:click={() => dispatch('close')} class="text-gray-400 hover:text-gray-600">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <!-- Tabs -->
            <div class="flex bg-gray-100 rounded-xl p-1 mb-6">
                <button
                    class="flex-1 py-2 text-sm font-bold rounded-lg transition-all {activeTab === 'link' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}"
                    on:click={() => activeTab = 'link'}
                >
                    {$t.invite.tab_link}
                </button>
                <button
                    class="flex-1 py-2 text-sm font-bold rounded-lg transition-all {activeTab === 'email' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}"
                    on:click={() => activeTab = 'email'}
                >
                    {$t.invite.tab_email}
                </button>
            </div>

            <!-- Tab Content: Share Link -->
            {#if activeTab === 'link'}
                <div class="flex flex-col items-center space-y-4">
                    <div class="w-48 h-48 bg-white rounded-lg flex items-center justify-center border-2 border-dashed border-gray-200">
                        {#if linkLoading}
                            <svg class="animate-spin h-8 w-8 text-gray-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        {:else if qrCodeDataUrl}
                            <img src={qrCodeDataUrl} alt="Invite QR Code" class="w-full h-full object-contain" />
                        {:else}
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                            </svg>
                        {/if}
                    </div>

                    <p class="text-xs text-gray-400 text-center">{$t.invite.scan_text}</p>

                    <button
                        class="w-full flex items-center justify-center space-x-2 py-3 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 active:scale-95 transition-transform"
                        on:click={handleShare}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                        <span>{$t.invite.share_button}</span>
                    </button>
                </div>
            {/if}

            <!-- Tab Content: By Email -->
            {#if activeTab === 'email'}
                <div class="space-y-4">
                    <p class="text-sm text-gray-500">{$t.invite.email_desc}</p>

                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{$t.invite.email_label}</label>
                        <div class="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-brand-sage/20 focus-within:border-brand-sage">
                            <input
                                type="email"
                                bind:value={identifierInput}
                                placeholder={$t.invite.placeholder}
                                class="flex-1 p-3 text-sm text-gray-900 outline-none pl-3"
                                on:keydown={(e) => { if (e.key === 'Enter') sendInvite(); }}
                            />
                        </div>
                    </div>

                    <!-- Suggested Members -->
                    {#if loadingSuggestions}
                        <div class="text-center py-2">
                             <span class="text-xs text-gray-400">{$t.invite.suggestions_loading}</span>
                        </div>
                    {:else if suggestedUsers.length > 0}
                        <div class="space-y-2">
                            <div class="text-xs font-bold text-gray-400 uppercase tracking-wider">{$t.invite.suggestions_header}</div>
                            <div class="max-h-32 overflow-y-auto space-y-1">
                                {#each suggestedUsers as user}
                                    <button 
                                        class="w-full flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg group transition-colors text-left"
                                        on:click={() => identifierInput = user.email}
                                    >
                                        <div class="flex flex-col">
                                            <span class="text-xs font-bold text-gray-700">
                                                {user.first_name}
                                            </span>
                                            <span class="text-[10px] text-gray-400">{user.email || ''}</span>
                                        </div>
                                        <div class="text-brand-sage opacity-0 group-hover:opacity-100 text-xs font-bold">
                                            {$t.invite.select}
                                        </div>
                                    </button>
                                {/each}
                            </div>
                        </div>
                    {/if}

                    <!-- Status Message -->
                    {#if inviteMessage}
                        <div class="text-sm p-3 rounded-lg {inviteStatus === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}">
                            {inviteMessage}
                        </div>
                    {/if}

                    <button
                        class="w-full py-3 bg-brand-sage text-white font-bold rounded-xl shadow-lg shadow-brand-sage/20 active:scale-95 transition-transform disabled:opacity-50"
                        on:click={sendInvite}
                        disabled={!identifierInput.trim() || inviteStatus === 'sending'}
                    >
                        {#if inviteStatus === 'sending'}
                            <span class="flex items-center justify-center space-x-2">
                                <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>{$t.invite.button_sending}</span>
                            </span>
                        {:else}
                            {$t.invite.button_send}
                        {/if}
                    </button>
                </div>
            {/if}
        </div>
    </div>
</div>
