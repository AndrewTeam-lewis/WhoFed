<script lang="ts">
  import { authService, type RegisterData } from '$lib/services/auth';
  import { goto } from '$app/navigation';
  import { t } from '$lib/services/i18n';
  import LanguagePicker from '$lib/components/LanguagePicker.svelte';

  let formData: RegisterData = {
    email: '',
    password: '',
    firstName: ''
  };

  let error = '';
  let success = '';
  let termsAccepted = false;


  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = '';
    success = '';

    // Validate required fields
    if (!formData.email || !formData.password || !formData.firstName) {
      error = $t.auth.error_all_fields_required;
      return;
    }

    if (!termsAccepted) {
      error = $t.auth.error_accept_terms;
      return;
    }

    try {
      await authService.register(formData);
      success = 'Registration successful! Redirecting...';
      
      // Check for redirect param
      const urlParams = new URLSearchParams(window.location.search);
      const redirectTo = urlParams.get('redirectTo');
      
      setTimeout(() => goto(redirectTo ? decodeURIComponent(redirectTo) : '/app'), 1500);
    } catch (e: any) {
      error = e.message || 'Registration failed';
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

<div class="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
  <div class="w-full max-w-md bg-white rounded-[32px] shadow-xl p-8 animate-fade-in">
    <div class="text-center mb-8">
      <div class="w-24 h-24 mx-auto mb-4">
        <img src="/whofed_logo.png" alt="WhoFed Logo" class="w-full h-full object-contain" />
      </div>
      <h1 class="text-3xl font-black text-gray-900 tracking-tight">{$t.auth.join_title}</h1>
      <p class="text-brand-sage font-bold uppercase tracking-widest text-xs mt-2">{$t.auth.create_account_subtitle}</p>
    </div>

  {#if error}
    <div class="bg-red-50 text-red-600 p-4 rounded-2xl mb-6 text-sm font-medium text-center">{error}</div>
  {/if}

  {#if success}
    <div class="bg-green-50 text-green-600 p-4 rounded-2xl mb-6 text-sm font-medium text-center">{success}</div>
  {/if}

  <form on:submit={handleSubmit} class="space-y-5">
    <div>
      <label for="email" class="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 ml-1">{$t.auth.email_label}</label>
      <input 
        id="email"
        type="email" 
        bind:value={formData.email} 
        required 
        placeholder="your@email.com"
        class="w-full p-4 bg-gray-50 border-transparent focus:bg-white focus:border-brand-sage focus:ring-0 rounded-2xl font-bold text-gray-900 transition-all placeholder-gray-300" 
      />
    </div>

    <div>
      <label for="password" class="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 ml-1">{$t.auth.password_label}</label>
      <input 
        id="password"
        type="password" 
        bind:value={formData.password} 
        required 
        minlength="6"
        placeholder={$t.auth.password_min}
        class="w-full p-4 bg-gray-50 border-transparent focus:bg-white focus:border-brand-sage focus:ring-0 rounded-2xl font-bold text-gray-900 transition-all placeholder-gray-300" 
      />
    </div>

    <div class="grid grid-cols-1 gap-4">
        <div>
            <label for="firstName" class="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 ml-1">{$t.auth.display_name_label}</label>
            <input 
                id="firstName"
                type="text" 
                bind:value={formData.firstName} 
                required 
                placeholder={$t.auth.display_name_placeholder}
                class="w-full p-4 bg-gray-50 border-transparent focus:bg-white focus:border-brand-sage focus:ring-0 rounded-2xl font-bold text-gray-900 transition-all placeholder-gray-300" 
            />
        </div>
    </div>

    <div class="flex items-start mt-4 mb-2">
        <div class="flex items-center h-5">
            <input 
                id="terms" 
                type="checkbox" 
                bind:checked={termsAccepted}
                class="w-4 h-4 accent-brand-sage text-brand-sage bg-gray-50 border-gray-300 rounded focus:ring-brand-sage focus:ring-2" 
                required
            />
        </div>
        <div class="ml-3 text-xs text-gray-500 font-medium leading-tight">
            <label for="terms">
                {$t.auth.agree_to_terms_prefix} <a href="/legal/tos" class="underline hover:text-brand-sage" target="_blank">{$t.settings.terms_of_service}</a> &amp; <a href="/legal/privacy" class="underline hover:text-brand-sage" target="_blank">{$t.settings.privacy_policy}</a>.
            </label>
        </div>
    </div>

    <button 
      type="submit" 
      class="w-full py-4 bg-brand-sage text-white font-bold rounded-2xl shadow-lg shadow-brand-sage/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
    >
      {$t.auth.create_account_btn}
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

  <p class="text-center text-sm text-gray-500">
    {$t.auth.already_have_account} <a href="/auth/login" class="text-brand-sage font-bold hover:underline">{$t.auth.log_in_link}</a>
  </p>
  </div>
</div>

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
