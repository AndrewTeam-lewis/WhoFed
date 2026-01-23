<script lang="ts">
  import { supabase } from '$lib/supabase';
  import { syncUsersToSupabase } from '$lib/supabase';
  import { db } from '$lib/db';
  import { onMount } from 'svelte';

  let envCheck = {
    url: '',
    keyPresent: false,
    urlPresent: false
  };

  let dbUsers: any[] = [];
  let supabaseUsers: any[] = [];
  let syncLog = '';
  let error = '';

  onMount(async () => {
    // Check env vars
    envCheck.url = import.meta.env.VITE_SUPABASE_URL || '';
    envCheck.keyPresent = !!import.meta.env.VITE_SUPABASE_ANON_KEY;
    envCheck.urlPresent = !!import.meta.env.VITE_SUPABASE_URL;

    // Get local Dexie users
    try {
      dbUsers = await db.profiles.toArray();
    } catch (e: any) {
      error = `Dexie error: ${e.message}`;
    }

    // Try to get Supabase users
    try {
      const { data, error: supaError } = await supabase
        .from('profiles')
        .select('*');
      
      if (supaError) {
        // Only show error if we expected to connect, but for offline shell it might be expected to fail if not config'd
        console.warn('Supabase error:', supaError);
        // error = `Supabase error: ${supaError.message}`; 
      } else {
        supabaseUsers = data || [];
      }
    } catch (e: any) {
      // error = `Connection error: ${e.message}`;
      console.warn('Supabase connection error:', e);
    }
  });

  async function testSync() {
    syncLog = 'Starting sync test...\n';
    try {
      await syncUsersToSupabase();
      syncLog += 'Sync completed! Check console for details.\n';
      
      // Refresh data
      const { data } = await supabase.from('profiles').select('*');
      supabaseUsers = data || [];
    } catch (e: any) {
      syncLog += `Sync failed: ${e.message}\n`;
    }
  }
</script>

<div class="max-w-4xl mx-auto mt-10 p-6 space-y-6">
  <h1 class="text-3xl font-bold">Database Debug Page</h1>

  <div class="bg-blue-50 border border-blue-200 p-4 rounded">
    <h2 class="text-xl font-semibold mb-2">Environment Variables</h2>
    <p><strong>VITE_SUPABASE_URL present:</strong> {envCheck.urlPresent ? '✅' : '❌'}</p>
    <p><strong>VITE_SUPABASE_URL value:</strong> {envCheck.url || '(empty)'}</p>
    <p><strong>VITE_SUPABASE_ANON_KEY present:</strong> {envCheck.keyPresent ? '✅' : '❌'}</p>
  </div>

  {#if error}
    <div class="bg-red-100 border border-red-400 text-red-700 p-4 rounded">
      <strong>Error:</strong> {error}
    </div>
  {/if}

  <div class="bg-gray-50 border border-gray-200 p-4 rounded">
    <h2 class="text-xl font-semibold mb-2">Local Dexie Profiles ({dbUsers.length})</h2>
    {#if dbUsers.length === 0}
      <p class="text-gray-500">No profiles in local database</p>
    {:else}
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="bg-gray-200">
              <th class="p-2 text-left">ID</th>
              <th class="p-2 text-left">Username</th>
              <th class="p-2 text-left">First Name</th>
            </tr>
          </thead>
          <tbody>
            {#each dbUsers as user}
              <tr class="border-t">
                <td class="p-2">{user.id}</td>
                <td class="p-2">{user.username}</td>
                <td class="p-2">{user.first_name}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>

  <div class="bg-green-50 border border-green-200 p-4 rounded">
    <h2 class="text-xl font-semibold mb-2">Supabase Profiles ({supabaseUsers.length})</h2>
    {#if supabaseUsers.length === 0}
      <p class="text-gray-500">No profiles in Supabase (or connection failed)</p>
    {:else}
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="bg-green-200">
              <th class="p-2 text-left">ID</th>
              <th class="p-2 text-left">Username</th>
              <th class="p-2 text-left">First Name</th>
            </tr>
          </thead>
          <tbody>
            {#each supabaseUsers as user}
              <tr class="border-t">
                <td class="p-2">{user.id}</td>
                <td class="p-2">{user.username}</td>
                <td class="p-2">{user.first_name}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>

  <div class="space-y-2">
    <button 
      onclick={testSync}
      class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
    >
      Test Sync Now
    </button>
    
    {#if syncLog}
      <pre class="bg-gray-800 text-green-400 p-4 rounded text-sm">{syncLog}</pre>
    {/if}
  </div>

  <div class="text-sm text-gray-600">
    <p><strong>Open browser console (F12)</strong> to see detailed sync logs</p>
  </div>
</div>
