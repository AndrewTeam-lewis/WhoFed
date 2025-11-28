<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<nav class="bg-gray-800 text-white p-4">
  <div class="container mx-auto flex justify-between items-center">
    <a href="/" class="text-xl font-bold">Offline App</a>
    <div class="space-x-4">
      <a href="/login" class="hover:text-gray-300">Login</a>
      <a href="/register" class="hover:text-gray-300">Register</a>
      <a href="/profile" class="hover:text-gray-300">Profile</a>
    </div>
  </div>
</nav>

<main class="container mx-auto p-4">
  {@render children()}
</main>
