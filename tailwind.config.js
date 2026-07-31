/**
 * This file is intentionally empty.
 *
 * This project uses Tailwind CSS v4 via @tailwindcss/vite, which does NOT use
 * tailwind.config.js. All configuration (CSS variables, custom variants, etc.)
 * lives in src/index.css using @import "tailwindcss" and Tailwind v4 directives.
 *
 * The old v3 content (require('tailwindcss-animate')) has been removed because:
 *  1. tailwindcss-animate is not in package.json
 *  2. require() is CommonJS — incompatible with "type": "module" in package.json
 *  3. Tailwind v4 does not read this file at all
 */
