# Starlaban photo and app redesign - 24 October 2026

## Restoring the previous version

The complete previous published state is preserved on GitHub branch `backup/pre-photo-redesign-2026-10-24`, commit `038d7d50de78134b15063c615367bc1013a6cd3c`. Restore through a normal reviewed commit or GitHub deployment change; no history reset is required.

## Delivered interfaces

- Website: original Starlaban photography, responsive black/gold/cream layout inspired by the Salool reference, searchable/filterable menu, on-page customization and shared persistent cart, app preview, story, 32-image photo journal and lightbox.
- App: phone sign-in and OTP entry views; guest access; Home, Rewards, Order, Gifts, Account tabs; wallet, order history, settings, payment preferences, support, personal details, notifications, single Starlaban pickup location, photo journal and gift preview.
- Shared cart: size at confirmed menu prices, sugar, ice, quantity, notes, edit/remove, persistence across website and app, subtotal, and add feedback with reduced-motion support.
- Source photos are resized/encoded as WebP for delivery; provided originals in Downloads are untouched. No generative edits were made.
- Photos are matched only where appropriate. Generic hot-cup photos are labelled serving suggestions in product details. Menu items without a corresponding photo use a consistent neutral placeholder.
- Confirmed drink prices were retained, including Black Tea small $0.75 / medium $1.50. Pastries/food without supplied prices display 'Price in cafe' and cannot be purchased.

## Service boundaries

This remains a static website and interactive browser app preview, not a signed native iOS/Android build. It does not send real orders, move funds, issue real rewards/gifts, or connect to Odoo. Preview orders are explicitly marked as not sent to the cafe. No fake SMS code is used. Guest profile preferences are local device data and do not authenticate a user.

Before launch: verify final product names/prices, store address/hours, contact details and purchase/privacy/refund policies; connect authentication, Sifalo server payment verification and Odoo preparation/status integration; package/test native builds and complete store review.

## Public configuration

`assets/config.js` accepts public API base and contact/social details. Never put Sifalo/Odoo secrets in these files. With no API base, phone sign-in explains it is not live and offers guest access; support lets a guest copy a message.

Expected server endpoints for the optional auth/support adapter:

- POST /auth/otp/request { phone } -> { challengeId }; server sends/rate-limits an actual SMS.
- POST /auth/otp/verify { challengeId, code } -> { user: { name, phone } }; server establishes a secure cookie session.
- POST /auth/logout {} -> successful logout.
- POST /account/delete {} -> authenticated account deletion.
- POST /support { category, message } -> successful accepted support request.

The server must validate input, enforce OTP expiry/attempt limits and authorization, secure sessions, CORS/CSRF controls, and support account deletion. Setting apiBase does not activate payments or Odoo; their backend and checkout flow still need implementation. Guest preferences and demo orders must not be trusted as server identity or payment status.

## Verification

Checked the reference video across its 98-second duration. Browser checks cover all principal screens, unavailable sign-in behavior, customization totals, cart edits and persistence, preview checkout, shared website/app cart, payment preferences, guest profile editing, unknown-price blocking, photo gallery/lightbox, EN/SO switching, and widths 320, 375, 768, 1440. No uncaught browser errors in the verified flows. Full live service and native device tests remain dependent on the integrations and builds.
