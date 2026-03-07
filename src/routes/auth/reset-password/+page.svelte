<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import { t } from '$lib/services/i18n';
  import LanguagePicker from '$lib/components/LanguagePicker.svelte';
  import { Capacitor } from '@capacitor/core';

  let password = '';
  let confirmPassword = '';
  let loading = false;
  let error = '';
  let showMobilePrompt = false;

  onMount(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      goto('/auth/login');
      return;
    }

    // Check if on mobile browser (not native app)
    if (!Capacitor.isNativePlatform()) {
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isMobile) {
        showMobilePrompt = true;
      }
    }
  });

  function openInApp() {
    const appUrl = `whofed://${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.href = appUrl;
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = '';

    if (password !== confirmPassword) {
      error = $t.auth.error_passwords_no_match;
      return;
    }

    if (password.length < 6) {
      error = $t.auth.error_password_min_length;
      return;
    }

    loading = true;

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) throw updateError;

      goto('/auth/login');
    } catch (e: any) {
      error = e.message || $t.auth.error_password_reset_failed;
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>{$t.auth.reset_password_title} - WhoFed</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 flex items-center justify-center p-4 md:p-6">
  <div class="w-full max-w-md bg-white rounded-2xl shadow-sm p-6 md:p-8">
    
    <h1 class="text-2xl md:text-3xl font-bold text-gray-800 text-center mb-2">{$t.auth.reset_password_title}</h1>
    <p class="text-sm text-gray-500 text-center mb-6 md:mb-8">{$t.auth.reset_password_subtitle}</p>

    {#if showMobilePrompt}
      <div class="bg-brand-sage/10 border-2 border-brand-sage rounded-xl p-4 mb-6">
        <div class="flex items-start space-x-3">
          <div class="flex-shrink-0">
            <svg class="w-6 h-6 text-brand-sage" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <div class="flex-1">
            <h3 class="font-bold text-brand-sage text-sm mb-1">Reset Password in App</h3>
            <p class="text-xs text-gray-700 mb-3">For the best experience, open this page in the WhoFed app.</p>
            <button
              on:click={openInApp}
              type="button"
              class="w-full bg-brand-sage text-white font-bold py-2.5 px-4 rounded-lg text-sm hover:bg-brand-sage/90 transition-colors"
            >
              Open in WhoFed App
            </button>
          </div>
        </div>
      </div>
    {/if}

    {#if error}
      <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
        {error}
      </div>
    {/if}

    <form on:submit={handleSubmit} class="space-y-4">
      <div class="mb-4">
        <label for="password" class="block text-sm font-medium text-gray-800 mb-2">{$t.auth.reset_password_new_label}</label>
        <input
          bind:value={password}
          id="password"
          type="password"
          placeholder="{$t.auth.reset_password_new_placeholder}"
          required
          class="w-full h-12 px-4 border border-slate-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-sage focus:border-transparent transition-all"
        />
      </div>

      <div class="mb-4">
        <label for="confirmPassword" class="block text-sm font-medium text-gray-800 mb-2">{$t.auth.reset_password_confirm_label}</label>
        <input
          bind:value={confirmPassword}
          id="confirmPassword"
          type="password"
          placeholder="{$t.auth.reset_password_confirm_placeholder}"
          required
          class="w-full h-12 px-4 border border-slate-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-sage focus:border-transparent transition-all"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        class="w-full h-12 bg-brand-sage text-white font-semibold rounded-lg hover:bg-brand-sage/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center mt-6"
      >
        {#if loading}
          <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span class="ml-2">{$t.auth.reset_password_resetting}</span>
        {:else}
          {$t.auth.reset_password_button}
        {/if}
      </button>
    </form>

    <p class="mt-6 text-center text-sm text-gray-500">
      <a href="/auth/login" class="text-brand-sage hover:text-brand-sage/90 font-medium transition-colors">{$t.auth.reset_password_back_to_login}</a>
    </p>
  </div>
</div>

<LanguagePicker />
