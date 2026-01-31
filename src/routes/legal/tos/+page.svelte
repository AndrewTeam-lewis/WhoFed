<script>
  import { goto } from '$app/navigation';
</script>

<div class="min-h-screen bg-white pb-20">
    <!-- Header -->
    <header class="bg-white px-6 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center border-b border-gray-100 sticky top-0 z-10">
        <button on:click={() => goto('/settings')} class="mr-4 p-2 -ml-2 text-gray-500 hover:text-gray-900 rounded-full hover:bg-gray-100 transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" />
            </svg>
        </button>
        <h1 class="text-xl font-bold text-gray-900">Terms of Service</h1>
    </header>

    <main class="p-6 max-w-lg mx-auto prose prose-sm prose-sage">
        <h2 class="text-xl font-bold mb-2">Terms of Service for WhoFed</h2>
        <p class="text-gray-500 text-xs mb-6">Last Updated: January 30, 2026</p>

        <p>Welcome to WhoFed. By using our app, you are entering into a binding agreement with us. Our goal is to make sure your pets are fed and your household stays organized.</p>

        <h3>1. The Service</h3>
        <p>WhoFed provides a platform for tracking pet feeding times and sending reminders. While we strive for 100% accuracy, WhoFed is a tool to assist you, not a replacement for human oversight.</p>

        <h3>2. Eligibility & Account Security</h3>
        <p><strong>Age:</strong> You must be at least 13 years old (or 16 in certain EU jurisdictions) to use WhoFed.</p>
        <p><strong>Account Info:</strong> You agree to provide accurate information (Name, Email, etc.). You are responsible for maintaining the confidentiality of your password.</p>
        <p><strong>Notifications:</strong> If you provide a phone number for SMS notifications, you acknowledge that standard text messaging rates from your carrier may apply.</p>

        <h3>3. Data Collection & Privacy</h3>
        <p>We collect only what is necessary to run the app:</p>
        <ul>
            <li><strong>Personal Identifiers:</strong> First/Last Name, Username, Email, and Password.</li>
            <li><strong>Optional Data:</strong> Phone number for SMS alerts.</li>
            <li><strong>Pet Data:</strong> Your pet’s name.</li>
        </ul>
        
        <p><strong>For our California & EU Users:</strong></p>
        <ul>
            <li><strong>No Sale of Data:</strong> WhoFed does not sell, rent, or lease your personal data to third parties.</li>
            <li><strong>Your Rights:</strong> Regardless of location, you have the right to access the data we have on you or request its deletion. You can do this by contacting us at the email below.</li>
            <li><strong>Data Storage:</strong> By using WhoFed, you consent to your data being processed and stored in the United States.</li>
        </ul>

        <h3>4. Pet Safety Disclaimer (The "Good Human" Clause)</h3>
        <p>WhoFed is not a veterinary or medical service.</p>
        <ul>
            <li><strong>Reliability:</strong> We are not liable for missed feedings due to app crashes, notification failures, internet outages, or dead phone batteries.</li>
            <li><strong>Responsibility:</strong> The ultimate responsibility for the health and nutrition of your pet lies with you. Always double-check "Who Fed" the pet if the app seems out of sync.</li>
        </ul>

        <h3>5. Prohibited Activities</h3>
        <p>You agree not to:</p>
        <ul>
            <li>Use the app for any unauthorized or illegal purpose.</li>
            <li>Attempt to bypass any measures we use to prevent or restrict access to the app.</li>
            <li>Use the service to send "spam" or unsolicited notifications to other users.</li>
        </ul>

        <h3>6. Termination</h3>
        <p>You can stop using WhoFed at any time. We reserve the right to terminate accounts that violate these terms or engage in behavior that harms the service or other users.</p>

        <h3>7. Governing Law</h3>
        <p>These Terms are governed by and construed in accordance with the laws of the State of Michigan, without regard to its conflict of law principles. Any disputes shall be resolved in the courts located in Michigan.</p>

        <h3>8. Contact Us</h3>
        <p>If you have questions, concerns, or wish to exercise your data privacy rights, please reach out to: <br>Email: <a href="mailto:andrew@retomar.com">andrew@retomar.com</a></p>
    </main>
</div>
