<script lang="ts">
  import { authService } from '$lib/services/auth';
  import { currentUser } from '$lib/stores/user';
  import { goto } from '$app/navigation';

  let usernameOrEmail = '';
  let password = '';
  let error = '';

  async function handleLogin() {
    error = '';
    try {
      const user = await authService.login(usernameOrEmail, password);
      currentUser.set(user);
      goto('/profile');
    } catch (e: any) {
      error = e.message || 'Login failed';
    }
  }
</script>

<div class="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
  <h1 class="text-2xl font-bold mb-6 text-center">Login</h1>

  {#if error}
    <div class="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>
  {/if}

  <form onsubmit={handleLogin} class="space-y-4">
    <div>
      <label class="block text-sm font-medium text-gray-700">Username or Email</label>
      <input type="text" bind:value={usernameOrEmail} required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2" />
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700">Password</label>
      <input type="password" bind:value={password} required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2" />
    </div>

    <button type="submit" class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
      Login
    </button>
  </form>
</div>
