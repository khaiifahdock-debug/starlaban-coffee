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
- [x] 3D takeaway cup with the logo on its sleeve: drop-in + bounce + lid landing + steam on load, idle sway, drag to spin (website hero, app splash, app Stars tab; spins when stars are earned/redeemed)
- [x] Menu animations: website cards reveal with a stagger on scroll and on tab change, hover lift; app rows slide in on tab/category change, fly-to-cart emoji, star pop, progress bar fill
- [x] GitHub Pages is on (branch `main`, root): https://khaiifahdock-debug.github.io/starlaban-coffee/
- [x] Tested in headless Chromium (desktop + iPhone size): no console errors, drag works, reduced-motion and no-WebGL fallbacks work

Not done / next:
- [ ] Replace placeholders: real menu, prices, hours, WhatsApp number, social links
- [ ] Native-speaker review of Somali text
- [ ] Gift credit screen (button is a stub)
- [ ] Real backend: Node + Postgres/Supabase, credit ledger, gateway webhooks (Sifalo Pay or other), sandbox first
- [ ] Real mobile app in Expo (React Native), rebuilding these screens; 3D via expo-three, or a Lottie animation of the cup
- [ ] Apple Developer ($99/yr) and Google Play ($25) accounts, store submission

## How to test locally
`python3 -m http.server 8000` in this folder, then open http://localhost:8000/ and /app/ in a phone-sized window.
