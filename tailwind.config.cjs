/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                serif: ['Georgia', 'Cambria', '"Times New Roman"', 'Times', 'serif'],
                sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
            },
            colors: {
                cream: {
                    50: '#FDFCFB',
                    100: '#FAF9F7',
                    200: '#F5F3F0',
                    300: '#EBE8E4',
                    400: '#D9D5CF',
                },
            },
        },
    },
    plugins: [],
}
