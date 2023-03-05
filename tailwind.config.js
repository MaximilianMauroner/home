/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
    theme: {
        extend: {
            keyframes: {
                "background-pan": {
                    "0%": { "background-position": "0% center" },
                    "100%": { "background-position": "-200% center" },
                },
                "underline-width": {
                    "0%": { width: "0%" },
                    "100%": { width: "100%" },
                },
            },
            animation: {
                pan: "background-pan 3s linear infinite",
                underline: "underline-width .25s linear",
                "pan-underline":
                    "background-pan 3s linear infinite, underline-width .25s linear",
            },
        },
    },
    plugins: [],
};
