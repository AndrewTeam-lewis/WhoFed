/** @type {import('tailwindcss').Config} */
export default {
    content: ['./src/**/*.{html,js,svelte,ts}'],
    theme: {
        extend: {
            colors: {
                // strict palette
                brand: {
                    sage: '#8BA889',      // Primary Brand Green
                    light: '#AEC2AC',     // Secondary Sage
                    success: '#D1E0D1',   // Soft Success
                },
                neutral: {
                    bg: '#F8FAFB',        // Main Page Background
                    surface: '#F2F5F2',   // Component Background (inputs, chips)
                },
                typography: {
                    primary: '#3C4759',   // Dark Navy (Headings)
                    secondary: '#9CA3AF', // Muted Gray (Subtext)
                }
            },
            borderRadius: {
                '4xl': '32px',
                '5xl': '40px',
            },
            boxShadow: {
                'soft': '0 8px 30px rgba(0, 0, 0, 0.04)',
            }
        },
    },
    plugins: [],
}
