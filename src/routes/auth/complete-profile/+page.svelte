<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authService } from '$lib/services/auth';
  import { currentUser } from '$lib/stores/user';
  import type { Profile } from '$lib/db';

  let formData = {
    username: '',
    firstName: '',
    lastName: '',
    phone: ''
  };

  let error = '';
  let loading = false;
  let userId = '';
  let usernameChecking = false;
  let usernameAvailable: boolean | null = null;
  let checkTimeout: number;

  onMount(async () => {
    const session = await authService.getSession();
    
    if (!session?.user) {
      goto('/login');
      return;
    }

    userId = session.user.id;

    // Pre-fill from OAuth data if available
    const metadata = session.user.user_metadata;
    if (metadata) {
      formData.firstName = metadata.full_name?.split(' ')[0] || metadata.given_name || '';
      formData.lastName = metadata.family_name || metadata.full_name?.split(' ').slice(1).join(' ') || '';
    }
  });

  async function checkUsername() {
    if (!formData.username || formData.username.length < 3) {
      usernameAvailable = null;
      return;
    }

    usernameChecking = true;
    try {
      const available = await authService.checkUsernameAvailable(formData.username);
      usernameAvailable = available;
    } catch (e) {
      usernameAvailable = null;
    }
    usernameChecking = false;
  }

  function onUsernameInput() {
    clearTimeout(checkTimeout);
    usernameAvailable = null;
    checkTimeout = setTimeout(checkUsername, 500);
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = '';

    if (!formData.username || !formData.firstName) {
      error = 'Username and first name are required';
      return;
    }

    if (usernameAvailable === false) {
      error = 'Username is already taken';
      return;
    }

    loading = true;

    try {
      await authService.createProfile(userId, {
        username: formData.username,
        first_name: formData.firstName,
        last_name: formData.lastName || undefined,
        phone: formData.phone || undefined
      });

      goto('/profile');
    } catch (e: any) {
      error = e.message || 'Failed to create profile';
    } finally {
      loading = false;
    }
  }
</script>

<div class="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
  <h1 class="text-2xl font-bold mb-2 text-center">Complete Your Profile</h1>
  <p class="text-sm text-gray-600 mb-6 text-center">Just a few more details to get started</p>

  {#if error}
    <div class="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>
  {/if}

  <form on:submit={handleSubmit} class="space-y-4">
    <div>
      <label for="username" class="block text-sm font-medium text-gray-700">Username *</label>
      <div class="relative">
        <input 
          id="username"
          type="text" 
          bind:value={formData.username} 
          on:input={onUsernameInput}
          required 
          minlength="3"
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2 pr-8" 
        />
        {#if usernameChecking}
          <span class="absolute right-2 top-3 text-gray-400">...</span>
        {:else if usernameAvailable === true}
          <span class="absolute right-2 top-3 text-green-600">✓</span>
        {:else if usernameAvailable === false}
          <span class="absolute right-2 top-3 text-red-600">✗</span>
        {/if}
      </div>
      {#if usernameAvailable === false}
        <p class="text-sm text-red-600 mt-1">Username already taken</p>
      {/if}
    </div>

    <div>
      <label for="firstName" class="block text-sm font-medium text-gray-700">First Name *</label>
      <input 
        id="firstName"
        type="text" 
        bind:value={formData.firstName} 
        required 
        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2" 
      />
    </div>

    <div>
      <label for="lastName" class="block text-sm font-medium text-gray-700">Last Name</label>
      <input 
        id="lastName"
        type="text" 
        bind:value={formData.lastName} 
        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2" 
      />
    </div>

    <div>
      <label for="phone" class="block text-sm font-medium text-gray-700">Phone</label>
      <input 
        id="phone"
        type="tel" 
        bind:value={formData.phone} 
        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2" 
      />
      <p class="text-xs text-gray-500 mt-1">Optional - for notifications</p>
    </div>

    <button 
      type="submit" 
      disabled={loading || usernameAvailable === false}
      class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
    >
      {loading ? 'Creating profile...' : 'Complete Profile'}
    </button>
  </form>
</div>
