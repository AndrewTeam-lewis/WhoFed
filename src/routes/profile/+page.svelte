<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { currentUser, currentProfile } from '$lib/stores/user';
  import { authService } from '$lib/services/auth';

  let editing = false;
  let editData = {
    username: '',
firstName: '',
    lastName: '',
    phone: ''
  };

  let message = '';
  let error = '';

  onMount(async () => {
    if (!$currentUser) {
      goto('/auth/login');
      return;
    }

    // Ensure profile is loaded
    if (!$currentProfile && $currentUser) {
      const profile = await authService.getProfile($currentUser.id);
      if (profile) {
        currentProfile.set(profile);
      }
    }

    // Initialize edit data
    if ($currentProfile) {
      editData = {
        username: $currentProfile.username,
        firstName: $currentProfile.first_name,
        lastName: $currentProfile.last_name || '',
        phone: $currentProfile.phone || ''
      };
    }
  });

  function startEdit() {
    editing = true;
    message = '';
    error = '';
  }

  function cancelEdit() {
    editing = false;
    if ($currentProfile) {
      editData = {
        username: $currentProfile.username,
        firstName: $currentProfile.first_name,
        lastName: $currentProfile.last_name || '',
        phone: $currentProfile.phone || ''
      };
    }
  }

  async function handleUpdate(e: Event) {  
    e.preventDefault();
    message = '';
    error = '';

    if (!$currentUser) return;

    try {
      const updated = await authService.updateProfile($currentUser.id, {
        username: editData.username,
        first_name: editData.firstName,
        last_name: editData.lastName || undefined,
        phone: editData.phone || undefined
      });

      currentProfile.set(updated);
      editing = false;
      message = 'Profile updated successfully!';
    } catch (e: any) {
      error = e.message || 'Failed to update profile';
    }
  }

  async function handleLogout() {
    try {
      await authService.logout();
      goto('/auth/login');
    } catch (e: any) {
      error = e.message || 'Logout failed';
    }
  }
</script>

<div class="max-w-2xl mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
  <h1 class="text-2xl font-bold mb-6">Profile</h1>

  {#if message}
    <div class="bg-green-100 text-green-700 p-3 rounded mb-4">{message}</div>
  {/if}

  {#if error}
    <div class="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>
  {/if}

  {#if $currentUser && $currentProfile}
    {#if !editing}
      <div class="space-y-4 mb-6">
        <div>
          <label class="block text-sm font-medium text-gray-700">Email</label>
          <p class="mt-1 text-gray-900">{$currentUser.email}</p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700">Username</label>
          <p class="mt-1 text-gray-900">{$currentProfile.username}</p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700">First Name</label>
          <p class="mt-1 text-gray-900">{$currentProfile.first_name}</p>
        </div>

        {#if $currentProfile.last_name}
          <div>
            <label class="block text-sm font-medium text-gray-700">Last Name</label>
            <p class="mt-1 text-gray-900">{$currentProfile.last_name}</p>
          </div>
        {/if}

        {#if $currentProfile.phone}
          <div>
            <label class="block text-sm font-medium text-gray-700">Phone</label>
            <p class="mt-1 text-gray-900">{$currentProfile.phone}</p>
          </div>
        {/if}

        <div>
          <label class="block text-sm font-medium text-gray-700">Auth Provider</label>
          <p class="mt-1 text-gray-900 capitalize">{$currentUser.app_metadata.provider || 'email'}</p>
        </div>
      </div>

      <div class="flex gap-4">
        <button 
          on:click={startEdit}
          class="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
        >
          Edit Profile
        </button>

        <button 
          on:click={handleLogout}
          class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          Logout
        </button>
      </div>
    {:else}
      <form on:submit={handleUpdate} class="space-y-4">
        <div>
          <label for="username" class="block text-sm font-medium text-gray-700">Username</label>
          <input 
            id="username"
            type="text" 
            bind:value={editData.username} 
            required 
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2" 
          />
        </div>

        <div>
          <label for="firstName" class="block text-sm font-medium text-gray-700">First Name</label>
          <input 
            id="firstName"
            type="text" 
            bind:value={editData.firstName} 
            required 
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2" 
          />
        </div>

        <div>
          <label for="lastName" class="block text-sm font-medium text-gray-700">Last Name</label>
          <input 
            id="lastName"
            type="text" 
            bind:value={editData.lastName} 
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2" 
          />
        </div>

        <div>
          <label for="phone" class="block text-sm font-medium text-gray-700">Phone</label>
          <input 
            id="phone"
            type="tel" 
            bind:value={editData.phone} 
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2" 
          />
        </div>

        <div class="flex gap-4">
          <button 
            type="submit"
            class="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
          >
            Save Changes
          </button>

          <button 
            type="button"
            on:click={cancelEdit}
            class="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
          >
            Cancel
          </button>
        </div>
      </form>
    {/if}
  {:else}
    <p class="text-gray-500">Loading profile...</p>
  {/if}
</div>
