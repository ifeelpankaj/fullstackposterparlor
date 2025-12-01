"scripts": {
"dev": "npx nx run poster-parler:serve:development --no-inspect",
"prod": "npx nx run poster-parler:serve:production --no-inspect",
"start:prod":"node dist/apps/poster-parler/main.js"
"build": "npx nx build poster-parler",
"lint": "npx nx lint poster-parler",
"format": "npx nx format:write",
"graph": "npx nx graph",
"clean": "rm -rf dist node_modules && npm install"
},
