<script lang="ts">
  import { authService } from '$lib/services/auth';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { t } from '$lib/services/i18n';
  import LanguagePicker from '$lib/components/LanguagePicker.svelte';

  let usernameOrEmail = '';
  let password = '';
  let error = '';
  let loading = false;
  let checkingAuth = true;

  onMount(async () => {
    try {
        const session = await authService.getSession();
        if (session?.user) {
            goto('/app');
        } else {
            checkingAuth = false;
        }
    } catch (e) {
        console.error('Auth check failed', e);
        checkingAuth = false;
    }
  });

  async function handleLogin(e: Event) {
    e.preventDefault();
    error = '';
    loading = true;

    try {
      await authService.login(usernameOrEmail, password);
      const redirectTo = $page.url.searchParams.get('redirectTo');
      goto(redirectTo ? decodeURIComponent(redirectTo) : '/app');
    } catch (e: any) {
      error = e.message || 'Login failed';
    } finally {
      loading = false;
    }
  }

  async function handleGoogleSignIn() {
    try {
      await authService.signInWithGoogle();
      // OAuth will redirect, no need for manual navigation
    } catch (e: any) {
      error = e.message || 'Google sign-in failed';
    }
  }
</script>

{#if checkingAuth}
    <div class="min-h-screen flex items-center justify-center bg-gray-50">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-sage"></div>
    </div>
{:else}
<div class="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
  <div class="w-full max-w-md bg-white rounded-[32px] shadow-xl p-8 animate-fade-in">
    <div class="text-center mb-8">
      <div class="w-24 h-24 mx-auto mb-4">
        <img src="/whofed_logo.png" alt="WhoFed Logo" class="w-full h-full object-contain" />
      </div>
      <h1 class="text-3xl font-black text-gray-900 tracking-tight">{$t.auth.welcome_back}</h1>
      <p class="text-brand-sage font-bold uppercase tracking-widest text-xs mt-2">{$t.auth.log_in_subtitle}</p>
    </div>

    {#if error}
      <div class="bg-red-50 text-red-600 p-4 rounded-2xl mb-6 text-sm font-medium text-center">{error}</div>
    {/if}

    <form on:submit={handleLogin} class="space-y-5">
      <div>
        <label for="usernameOrEmail" class="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 ml-1">{$t.auth.email_username_label}</label>
        <input 
          id="usernameOrEmail"
          type="text" 
          bind:value={usernameOrEmail} 
          required 
          placeholder="your@email.com"
          class="w-full p-4 bg-gray-50 border-transparent focus:bg-white focus:border-brand-sage focus:ring-0 rounded-2xl font-bold text-gray-900 transition-all placeholder-gray-300" 
        />
      </div>

      <div>
        <label for="password" class="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 ml-1">{$t.auth.password_login_label}</label>
        <input 
          id="password"
          type="password" 
          bind:value={password} 
          required 
          placeholder="••••••••"
          class="w-full p-4 bg-gray-50 border-transparent focus:bg-white focus:border-brand-sage focus:ring-0 rounded-2xl font-bold text-gray-900 transition-all placeholder-gray-300" 
        />
      </div>

      <button 
        type="submit" 
        disabled={loading}
        class="w-full py-4 bg-brand-sage text-white font-bold rounded-2xl shadow-lg shadow-brand-sage/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? $t.auth.logging_in : $t.auth.log_in_link}
      </button>
    </form>

    <div class="mt-8 mb-6">
      <div class="relative">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-gray-100"></div>
        </div>
        <div class="relative flex justify-center text-sm">
          <span class="px-4 bg-white text-gray-400 font-medium text-xs uppercase tracking-wider">{$t.auth.or_continue_with}</span>
        </div>
      </div>

      <button
        type="button"
        on:click={handleGoogleSignIn}
        class="mt-6 w-full flex justify-center items-center gap-3 py-4 bg-white border border-gray-100 rounded-2xl shadow-sm text-gray-700 font-bold hover:bg-gray-50 transition-all hover:scale-[1.01] active:scale-[0.99]"
      >
        <svg class="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        {$t.auth.sign_in_google}
      </button>
    </div>

    <div class="text-center text-sm text-gray-500 mt-6 space-y-2">
      <p>
        {$t.auth.dont_have_account} <a href="/auth/register" class="text-brand-sage font-bold hover:underline">{$t.auth.create_account_btn}</a>
      </p>
      <div class="flex justify-center items-center space-x-3 text-xs text-gray-400">
        <a href="/legal/tos" class="hover:text-brand-sage transition-colors">{$t.settings?.terms_of_service || 'Terms of Service'}</a>
        <span>&bull;</span>
        <a href="/legal/privacy" class="hover:text-brand-sage transition-colors">{$t.settings?.privacy_policy || 'Privacy Policy'}</a>
      </div>
    </div>
  </div>
</div>
{/if}

<LanguagePicker />

<style>
    @keyframes fade-in {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in {
        animation: fade-in 0.4s ease-out forwards;
    }
</style>
