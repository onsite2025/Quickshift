# QuickShift

AI-powered nursing registry management for **QuickCare Nursing Registry**.

Facilities text in. AI parses the request. The right nurses get a blast — first YES wins. Compliance, timekeeping, and billing follow automatically.

## Stack

- **Next.js 14** (App Router, TypeScript, `src/`)
- **Firebase** Auth + Firestore + Storage (web SDK + Admin SDK)
- **Twilio** Programmable Messaging
- **Anthropic Claude** for parsing inbound SMS
- **Tailwind CSS**, lucide-react, date-fns, react-hot-toast

## Modules

1. **Shift Dispatch** — Twilio inbound webhook → AI parses → creates a draft `shifts` doc → broadcasts to qualified active nurses → first `YES <CODE>` wins via a Firestore transaction → confirmation SMS to nurse and facility.
2. **Compliance** — Storage uploads, expiration tracking, automatic nurse blocking.
3. **Timekeeping** — `IN`/`OUT` SMS commands create/close timesheets; UI for approval; Gusto CSV export.
4. **Billing** — One-click invoice generation across a date range; tracks status `draft → sent → paid`.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000 → sign up at `/login` → land on `/dashboard`.

### Firebase Auth

In **Firebase Console → Authentication → Sign-in method**, enable Email/Password.

### Required env vars (`.env.local`)

```
# Web SDK (already populated)
NEXT_PUBLIC_FIREBASE_API_KEY=…
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=…
NEXT_PUBLIC_FIREBASE_PROJECT_ID=quickshift-3b42d
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=…
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=…
NEXT_PUBLIC_FIREBASE_APP_ID=…

# Server SDK (Service account → Firebase Console → Project Settings → Service accounts)
FIREBASE_PROJECT_ID=quickshift-3b42d
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=        # keep "\n" escapes inline

# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=         # the registry's outbound/shared number
TWILIO_VALIDATE_SIGNATURE=true

# Claude (AI parser)
ANTHROPIC_API_KEY=

NEXT_PUBLIC_APP_URL=https://your-vercel-deployment.vercel.app
```

## SMS routing (the heart of the product)

`POST /api/twilio/inbound`

| Sender | Behavior |
| --- | --- |
| Number matches `facilities.inboundPhone` | Body parsed by Claude → draft shift created → broadcast to active nurses with matching role → reply confirms. |
| Number matches `nurses.phone`, body `YES <CODE>` | Atomic Firestore transaction claims the shift if still open. Confirmation SMS sent to nurse + facility. |
| Nurse, body starts with `IN` | Active confirmed shift → timesheet `clockIn`, shift → `in_progress`. |
| Nurse, body starts with `OUT` | Active in-progress shift → timesheet `clockOut`, hours computed, shift → `completed`. |
| Anything else | Help message. |

Twilio signature is validated using the auth token (`TWILIO_VALIDATE_SIGNATURE=false` only for local manual testing).

### Twilio configuration

For each Twilio phone number routed to QuickShift:

- **A MESSAGE COMES IN** → Webhook → `https://YOUR_DOMAIN/api/twilio/inbound` (POST)
- **STATUS CALLBACK URL** → `https://YOUR_DOMAIN/api/twilio/status` (POST)

### First-YES-wins safety

`claimShift()` in [src/lib/dispatch.ts](src/lib/dispatch.ts) runs inside `adminDb.runTransaction`, refusing the claim unless the shift is still in `open`/`broadcasting`. Subsequent YES messages get a "already claimed" reply.

## Folder structure

```
src/
├── app/
│   ├── layout.tsx            # AuthProvider + Toaster
│   ├── page.tsx              # → /dashboard
│   ├── globals.css           # Tailwind + design tokens
│   ├── login/                # Public sign-in / sign-up
│   ├── api/
│   │   ├── twilio/
│   │   │   ├── inbound/      # The big one — facility/nurse SMS router
│   │   │   └── status/       # Delivery callbacks
│   │   ├── shifts/[id]/dispatch/   # Manual broadcast trigger
│   │   ├── invoices/generate/      # Period invoice generation
│   │   └── timesheets/export/      # Gusto CSV
│   └── (app)/                # Authenticated route group
│       ├── dashboard/        # KPIs + grid + activity
│       ├── shifts/           # Grid (nurses × dates) + list view
│       ├── nurses/
│       ├── facilities/       # incl. shift template editor
│       ├── compliance/       # Upload to Firebase Storage
│       ├── timekeeping/      # Live + approve + Gusto export
│       └── billing/          # Invoice generation, status flow
├── components/               # Sidebar, Header, ShiftGrid, Modal, DataTable, …
│   └── forms/                # NurseForm, FacilityForm, ShiftForm, …
├── lib/
│   ├── firebase.ts           # Web SDK
│   ├── firebase-admin.ts     # Admin SDK (server only)
│   ├── auth.ts
│   ├── collections.ts        # Typed Firestore refs
│   ├── sms.ts                # Twilio client + signature validation
│   ├── ai-parser.ts          # Claude Haiku → structured shift request
│   ├── dispatch.ts           # createShiftFromRequest, broadcastShift, claimShift
│   ├── compliance.ts         # Document expiry → nurse status
│   ├── timekeeping.ts        # clockIn / clockOut
│   ├── invoices.ts           # generateInvoice
│   ├── gusto-export.ts       # CSV builder
│   └── utils.ts
└── types/index.ts            # All domain types
```

## Firestore collections

| Collection    | Notes |
| ------------- | ----- |
| `nurses`      | Roster (RN/LPN/CNA/NP). `status: "active" | "blocked" | …` |
| `facilities`  | `inboundPhone`, `shiftTemplates: ShiftTemplate[]` (AM/PM/NOC + hours) |
| `shifts`      | `status` flows draft → broadcasting → open → confirmed → in_progress → completed; `broadcast: BroadcastRecipient[]` records who got the SMS |
| `documents`   | Compliance records w/ Storage URL + expiry → drives nurse blocking |
| `timesheets`  | Created on SMS clock-in, closed on clock-out, approved in UI |
| `invoices`    | Generated by `/api/invoices/generate`; status flow `draft → sent → paid/overdue` |
| `messages`    | Reserved for future operator/nurse messaging |

## Deploying to Vercel

1. Push the repo (already done): https://github.com/onsite2025/Quickshift
2. **Vercel → Import Project** → select the repo.
3. Add all env vars above (paste `FIREBASE_PRIVATE_KEY` exactly as the JSON value, with `\n` escapes preserved).
4. Set `NEXT_PUBLIC_APP_URL` to the Vercel deployment URL.
5. Deploy. Then point Twilio webhooks at `https://YOUR_DOMAIN/api/twilio/...`.

## Security rules

[firestore.rules](firestore.rules) and [storage.rules](storage.rules) ship with a baseline "must be signed in" policy. Tighten per-role (admin / coordinator / nurse / facility) before scaling. Deploy with:

```bash
firebase deploy --only firestore:rules,storage
```

## Scripts

- `npm run dev` – local dev server
- `npm run build` – production build
- `npm run start` – run the production server
- `npm run lint` – ESLint via `next lint`
- `npm run typecheck` – `tsc --noEmit`

---

© QuickCare Nursing Registry
