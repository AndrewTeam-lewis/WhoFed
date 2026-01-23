<script lang="ts">
  import { supabase } from '$lib/supabase';

  let email = '';
  let loading = false;
  let success = false;
  let error = '';

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = '';
    loading = true;
    success = false;

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`
      });

      if (resetError) throw resetError;

      success = true;
    } catch (e: any) {
      error = e.message || 'Failed to send reset email';
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Forgot Password - Na Régua</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 flex items-center justify-center p-4 md:p-6">
  <div class="w-full max-w-md bg-white rounded-2xl shadow-sm p-6 md:p-8">
    
    <h1 class="text-2xl md:text-3xl font-bold text-gray-800 text-center mb-2">Reset Password</h1>
    <p class="text-sm text-gray-500 text-center mb-6 md:mb-8">Enter your email to receive reset instructions</p>

    {#if error}
      <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
        {error}
      </div>
    {/if}

    {#if success}
      <div class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6 text-sm">
        Check your email for password reset instructions.
      </div>
    {/if}

    <form on:submit={handleSubmit} class="space-y-4">
      <div class="mb-4">
        <label for="email" class="block text-sm font-medium text-gray-800 mb-2">Email</label>
        <input
          id="email"
          type="email"
          bind:value={email}
          placeholder="Enter your email"
          required
          class="w-full h-12 px-4 border border-slate-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
          autocomplete="email"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        class="w-full h-12 bg-emerald-500 text-white font-semibold rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center mt-6"
      >
        {#if loading}
          <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span class="ml-2">Sending...</span>
        {:else}
          Send Reset Link
        {/if}
      </button>
    </form>

    <p class="mt-6 text-center text-sm text-gray-500">
      <a href="/auth/login" class="text-emerald-500 hover:text-emerald-600 font-medium transition-colors">Back to Login</a>
    </p>
  </div>
</div>
