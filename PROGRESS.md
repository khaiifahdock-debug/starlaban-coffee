# Starlaban Coffee: project handoff

Read this first if you are a new Claude session (or a developer) picking the project up.

## Purpose
A sample website and sample mobile-app prototype for **Starlaban Coffee** (Mogadishu, Somalia), built to match the Starlaban Taban Development Agreement (US$2,000 scope): coffee and donuts menu, ordering for pickup, store credit with top-ups (EVC Plus / Zaad / eDahab), loyalty stars, gift credit, English + Somali. Brand: dark brown `#2b1810`, gold `#c4955a`, cream `#f7e0c8`; logo is a coffee bean with a star inside a round badge.

## Rules
1. Payments in this repo are **simulated**. Never put payment keys, secrets or balances in front-end code. Real money logic lives on a server (credit ledger, gateway webhook confirmation) and is not built yet.
2. Keep everything working on **GitHub Pages** (static files, relative paths, no build step, no external CDNs). Three.js is vendored in `assets/vendor/three.min.js` (r149, global `THREE`).
3. Must work on **iPhone and Android**. Test over http(s), not by opening a file inside Mail/WhatsApp/Files (iOS previews don't run JavaScript).
4. 3D must stay light (cup3d.js): pixel ratio capped at 2, pauses off-screen / hidden tab, still frame for `prefers-reduced-motion`, logo image fallback when WebGL is missing.
5. Don't use `alert()` / `confirm()`; use on-page messages.
6. Placeholder content (prices, hours, phone, social links) is marked as sample. Somali text needs review by a native speaker.

## Layout
```
index.html               website (hero has the 3D cup)
app/index.html           app prototype (splash + Stars tab use the 3D cup)
assets/cup3d.js          StarlabanCup.mount(el, {logoSrc, fallbackSrc}) -> {burst(), replay(), destroy()}
assets/vendor/three.min.js
assets/logo.png, favicon.png, apple-touch-icon.png
```

## Status
Done:
- [x] Website (menu tabs, EN/SO, features, contact), no-JS menu fallback
- [x] App prototype (menu, cart, pickup time, pay with credit or mobile money, top-up, stars + redeem, EN/SO)
- [x] 3D takeaway cup with the logo on its sleeve: drops in, bounces, lid lands on the rim, then spins by itself (no steam, no dragging; touches pass through so the page scrolls). Used in the website hero, app splash and app Stars tab (spins faster when stars are earned/redeemed)
- [x] Colourful menu (categories Hot Drinks, Iced, Matcha, Donuts, Combos, each with its own accent colour): search, favourites (saved in localStorage), S/M sizes with live price, tags, "Surprise me" button, staggered reveal and 3D tilt on cards (website); same menu in the app with colour bubbles, sizes in the cart, fly-to-cart, star pop
- [x] Obvious language switch: English | Soomaali pill in the header of both pages, plus a hero button on the website; choice is remembered (`sl_lang`) and shared by site and app; first visit follows the phone language
- [x] Menu categories and matcha names (Classic, Pink, Strawberry, Blueberry, Ube Latte) taken from the photo of the restaurant's screens. The photo was blurry: prices and the hot-drinks list could not be read, so all prices and several items are SAMPLES
- [x] GitHub Pages is on (branch `main`, root): https://khaiifahdock-debug.github.io/starlaban-coffee/
- [x] Tested in headless Chromium (desktop + iPhone size): no console errors, drag works, reduced-motion and no-WebGL fallbacks work

Not done / next:
- [ ] Replace placeholders: real menu and prices (ask for clear photos of each screen), hours, WhatsApp number, social links. The menu is the `ITEMS` array near the bottom of `index.html` and of `app/index.html` (same data in both: edit both). Row format: [id, category, emoji, name, description EN, description SO, price (small size), tag, has sizes, colour]
- [ ] Native-speaker review of Somali text
- [ ] Gift credit screen (button is a stub)
- [ ] Real backend: Node + Postgres/Supabase, credit ledger, gateway webhooks (Sifalo Pay or other), sandbox first
- [ ] Real mobile app in Expo (React Native), rebuilding these screens; 3D via expo-three, or a Lottie animation of the cup
- [ ] Apple Developer ($99/yr) and Google Play ($25) accounts, store submission

## Notes for editing
- `index.html` and `app/index.html` are plain files edited by hand (no build step). Keep the ribbon wrapper (`.ribbon-wrap`) so the page never scrolls sideways.
- Sizes: M costs +$0.50 over S (sample rule, based on the S/M columns visible on the restaurant's hot-drinks screen).

## How to test locally
`python3 -m http.server 8000` in this folder, then open http://localhost:8000/ and /app/ in a phone-sized window.
