<script lang="ts">
  import { authService } from '$lib/services/auth';
  import { goto } from '$app/navigation';

  let usernameOrEmail = '';
  let password = '';
  let error = '';
  let loading = false;

  import { page } from '$app/stores';

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

<div class="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
  <h1 class="text-2xl font-bold mb-6 text-center">Login</h1>

  {#if error}
    <div class="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>
  {/if}

  <form on:submit={handleLogin} class="space-y-4">
    <div>
      <label for="usernameOrEmail" class="block text-sm font-medium text-gray-700">Email or Username</label>
      <input 
        id="usernameOrEmail"
        type="text" 
        bind:value={usernameOrEmail} 
        required 
        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2" 
      />
    </div>

    <div>
      <label for="password" class="block text-sm font-medium text-gray-700">Password</label>
      <input 
        id="password"
        type="password" 
        bind:value={password} 
        required 
        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2" 
      />
    </div>

    <button 
      type="submit" 
      disabled={loading}
      class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
    >
      {loading ? 'Logging in...' : 'Login'}
    </button>
  </form>

  <div class="mt-4">
    <div class="relative">
      <div class="absolute inset-0 flex items-center">
        <div class="w-full border-t border-gray-300"></div>
      </div>
      <div class="relative flex justify-center text-sm">
        <span class="px-2 bg-white text-gray-500">Or continue with</span>
      </div>
    </div>

    <button
      type="button"
      on:click={handleGoogleSignIn}
      class="mt-4 w-full flex justify-center items-center gap-2 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
    >
      <svg class="w-5 h-5" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      Sign in with Google
    </button>
  </div>

  <p class="mt-4 text-center text-sm text-gray-600">
    Don't have an account? <a href="/auth/register" class="text-indigo-600 hover:text-indigo-800 font-medium">Register</a>
  </p>
</div>
