# Global top navigation update

All pages now share `src/components/AppNavigation.tsx` via `src/app/layout.tsx`.

Desktop: Decision Center, Trading Dashboard, Swing Research, Buyer / Seller, Fear & Greed / RSI, and More dropdown for the rest.

Mobile/tablet: hamburger menu contains all 9 links. Current page highlighted.

Removed duplicate link rows from `src/components/Dashboard.tsx`, plus duplicate advanced link list from `src/app/v7/page.tsx`. No signal, monitoring, or trading engine logic changed.

Install and verify: `npm install && npm run typecheck && npm run build && npm run dev`.
