<script lang="ts">
    import { goto } from '$app/navigation';
</script>

<div class="min-h-screen bg-gradient-to-br from-brand-sage/10 to-brand-sand/20 flex flex-col">
    <!-- Hero Section -->
    <main class="flex-grow flex flex-col items-center justify-center p-6 text-center">
        <div class="mb-8 p-6 bg-white rounded-3xl shadow-xl shadow-brand-sage/10 animate-fade-in">
            <div class="w-28 h-28 mx-auto mb-6 flex items-center justify-center">
                <!-- App Logo -->
                <img src="/whofed_logo.png" alt="WhoFed Logo" class="w-full h-full object-contain" />
            </div>
            <h1 class="text-4xl font-black text-gray-900 mb-2 tracking-tight">WhoFed</h1>
            <p class="text-brand-sage font-bold uppercase tracking-widest text-sm">Pet Care Simplified</p>
        </div>

        <div class="max-w-md space-y-6">
            <p class="text-lg text-gray-600 leading-relaxed">
                Connect with your family to track feedings, medicine and more. Never ask "Who fed the dog?" again.
            </p>
            
            <button 
                on:click={() => goto('/auth/login')} 
                class="w-full py-4 bg-brand-sage text-white text-lg font-bold rounded-2xl shadow-lg shadow-brand-sage/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
                Log In
            </button>

            <div class="text-sm text-gray-500">
                <span class="opacity-75">New here?</span>
                <a href="/auth/register" class="font-bold text-brand-sage hover:underline ml-1">Create an account</a>
            </div>
        </div>
    </main>

    <!-- Footer -->
    <footer class="p-6 text-center text-xs text-gray-400 space-y-2">
        <div class="flex justify-center space-x-4">
            <a href="/legal/privacy" class="hover:text-brand-sage transition-colors">Privacy Policy</a>
            <span>•</span>
            <a href="/legal/tos" class="hover:text-brand-sage transition-colors">Terms of Service</a>
        </div>
        <p>© {new Date().getFullYear()} WhoFed</p>
    </footer>
</div>

<style>
    @keyframes fade-in {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in {
        animation: fade-in 0.6s ease-out forwards;
    }
</style>
