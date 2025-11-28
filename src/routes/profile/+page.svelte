<script lang="ts">
  import { authService } from '$lib/services/auth';
  import { currentUser } from '$lib/stores/user';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  let newPassword = '';
  let message = '';
  let error = '';

  onMount(() => {
    if (!$currentUser) {
      goto('/login');
    }
  });

  async function handleChangePassword() {
    message = '';
    error = '';
    if (!$currentUser || !$currentUser.id) return;

    try {
      await authService.updatePassword($currentUser.id, newPassword);
      message = 'Password updated successfully';
      newPassword = '';
    } catch (e: any) {
      error = e.message || 'Failed to update password';
    }
  }

  function handleLogout() {
    currentUser.set(null);
    goto('/login');
  }
</script>

<div class="max-w-2xl mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
  <h1 class="text-2xl font-bold mb-6">Profile</h1>

  {#if $currentUser}
    <div class="mb-8 space-y-2">
      <p><strong>Username:</strong> {$currentUser.username}</p>
      <p><strong>Email:</strong> {$currentUser.email}</p>
      <p><strong>First Name:</strong> {$currentUser.firstName}</p>
      <p><strong>Phone:</strong> {$currentUser.phone}</p>
      <p><strong>Sync Status:</strong> {$currentUser.synced ? 'Synced' : 'Not Synced'}</p>
    </div>

    <div class="border-t pt-6">
      <h2 class="text-xl font-semibold mb-4">Change Password</h2>
      
      {#if message}
        <div class="bg-green-100 text-green-700 p-3 rounded mb-4">{message}</div>
      {/if}
      
      {#if error}
        <div class="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>
      {/if}

      <form onsubmit={handleChangePassword} class="space-y-4 max-w-md">
        <div>
          <label class="block text-sm font-medium text-gray-700">New Password</label>
          <input type="password" bind:value={newPassword} required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2" />
        </div>
        <button type="submit" class="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">Update Password</button>
      </form>
    </div>

    <div class="mt-8 border-t pt-6">
      <button onclick={handleLogout} class="text-red-600 hover:text-red-800">Logout</button>
    </div>
  {/if}
</div>
