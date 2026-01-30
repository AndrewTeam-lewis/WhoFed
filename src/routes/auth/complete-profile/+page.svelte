<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authService } from '$lib/services/auth';
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
      goto('/auth/login');
      return;
    }

    userId = session.user.id;

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

      goto('/');
    } catch (e: any) {
      error = e.message || 'Failed to create profile';
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Complete Profile - Na Régua</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 flex items-center justify-center p-4 md:p-6">
  <div class="w-full max-w-md bg-white rounded-2xl shadow-sm p-6 md:p-8">
    
    <h1 class="text-2xl md:text-3xl font-bold text-gray-800 text-center mb-2">Complete Your Profile</h1>
    <p class="text-sm text-gray-500 text-center mb-6 md:mb-8">Just a few more details to get started</p>

    {#if error}
      <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
        {error}
      </div>
    {/if}

    <form on:submit={handleSubmit} class="space-y-4">
      <div class="mb-4">
        <label for="username" class="block text-sm font-medium text-gray-800 mb-2">Username</label>
        <div class="relative">
          <input
            id="username"
            type="text"
            bind:value={formData.username}
            on:input={onUsernameInput}
            placeholder="Choose a username"
            required
            minlength="3"
            class="w-full h-12 px-4 pr-10 border border-slate-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
            autocomplete="username"
          />
          <div class="absolute right-3 top-1/2 -translate-y-1/2">
            {#if usernameChecking}
              <svg class="animate-spin h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            {:else if usernameAvailable === true}
              <svg class="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            {:else if usernameAvailable === false}
              <svg class="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            {/if}
          </div>
        </div>
        {#if usernameAvailable === false}
          <p class="text-sm text-red-500 mt-1">Username already taken</p>
        {/if}
      </div>

      <div class="mb-4">
        <label for="firstName" class="block text-sm font-medium text-gray-800 mb-2">First Name</label>
        <input
          id="firstName"
          type="text"
          bind:value={formData.firstName}
          placeholder="Enter your first name"
          required
          class="w-full h-12 px-4 border border-slate-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
          autocomplete="given-name"
        />
      </div>

      <div class="mb-4">
        <div class="flex justify-between items-center mb-2">
          <label for="lastName" class="block text-sm font-medium text-gray-800">Last Name</label>
          <span class="text-xs text-gray-500">Optional</span>
        </div>
        <input
          id="lastName"
          type="text"
          bind:value={formData.lastName}
          placeholder="Enter your last name"
          class="w-full h-12 px-4 border border-slate-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
          autocomplete="family-name"
        />
      </div>

      <div class="mb-4">
        <div class="flex justify-between items-center mb-2">
          <label for="phone" class="block text-sm font-medium text-gray-800">Phone</label>
          <span class="text-xs text-gray-500">Optional, for notifications</span>
        </div>
        <input
          id="phone"
          type="tel"
          bind:value={formData.phone}
          placeholder="Enter your phone number"
          class="w-full h-12 px-4 border border-slate-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
          autocomplete="tel"
        />
      </div>

      <button
        type="submit"
        disabled={loading || usernameAvailable === false}
        class="w-full h-12 bg-emerald-500 text-white font-semibold rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center mt-6"
      >
        {#if loading}
          <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span class="ml-2">Creating profile...</span>
        {:else}
          Complete Profile
        {/if}
      </button>
    </form>
  </div>
</div>
