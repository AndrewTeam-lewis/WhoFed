<script lang="ts">
  import { authService, type RegisterData } from '$lib/services/auth';
  import { goto } from '$app/navigation';

  let formData: RegisterData = {
    username: '',
    email: '',
    password: '',
    firstName: '',
    phone: ''
  };

  let error = '';
  let success = '';

  async function handleSubmit() {
    error = '';
    success = '';
    try {
      await authService.register(formData);
      success = 'Registration successful! Redirecting to login...';
      setTimeout(() => goto('/login'), 2000);
    } catch (e: any) {
      error = e.message || 'Registration failed';
    }
  }
</script>

<div class="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
  <h1 class="text-2xl font-bold mb-6 text-center">Register</h1>

  {#if error}
    <div class="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>
  {/if}

  {#if success}
    <div class="bg-green-100 text-green-700 p-3 rounded mb-4">{success}</div>
  {/if}

  <form onsubmit={handleSubmit} class="space-y-4">
    <div>
      <label class="block text-sm font-medium text-gray-700">Username</label>
      <input type="text" bind:value={formData.username} required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2" />
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700">Email</label>
      <input type="email" bind:value={formData.email} required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2" />
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700">Phone Number</label>
      <input type="tel" bind:value={formData.phone} required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2" />
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700">First Name</label>
      <input type="text" bind:value={formData.firstName} required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2" />
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700">Password</label>
      <input type="password" bind:value={formData.password} required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2" />
    </div>

    <button type="submit" class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
      Register
    </button>
  </form>
</div>
