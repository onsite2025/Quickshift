# QuickShift

Nursing registry management platform built on Next.js 14 (App Router), Firebase (Auth, Firestore, Storage), and Tailwind CSS.

## Stack

- **Next.js 14** (App Router, TypeScript, `src/` layout)
- **Firebase** Auth + Firestore + Storage
- **Tailwind CSS**
- **lucide-react** for icons, **date-fns** for calendar math

## Getting started

```bash
npm install
npm run dev
```

The dev server runs on http://localhost:3000. The root path redirects to `/dashboard`, which requires sign-in. Use `/login` to create an account.

## Environment

`.env.local` is pre-populated with the QuickShift Firebase project config. To use a different project, copy `.env.local.example` and fill in your own values.

## Folder structure

```
src/
├── app/
│   ├── layout.tsx            # Root layout + AuthProvider
│   ├── page.tsx              # Redirects to /dashboard
│   ├── globals.css           # Tailwind + design tokens
│   ├── login/                # Public sign-in / sign-up
│   └── (app)/                # Authenticated route group
│       ├── layout.tsx        # Sidebar + RequireAuth wrapper
│       ├── dashboard/
│       ├── shifts/           # Calendar view
│       ├── nurses/
│       ├── facilities/
│       ├── compliance/
│       ├── timekeeping/
│       └── billing/
├── components/               # Sidebar, Header, AuthProvider, ShiftCalendar, DataTable, ...
├── lib/
│   ├── firebase.ts           # Firebase app/auth/db/storage exports
│   ├── auth.ts               # signIn / signUp / signOut helpers
│   ├── collections.ts        # Typed Firestore CollectionReferences
│   └── utils.ts              # cn() and formatCurrency()
└── types/
    └── index.ts              # Domain types
```

## Firestore collections

| Collection    | Purpose |
| ------------- | ------- |
| `nurses`      | Clinician roster (RN/LPN/CNA/NP), license info, status |
| `facilities`  | Client locations that request shifts |
| `shifts`      | Open / assigned / in-progress / completed shifts |
| `documents`   | Compliance records (licenses, certs, vaccinations) |
| `timesheets`  | Clock-in / clock-out and approval state |
| `invoices`    | Period invoices generated for facilities |
| `messages`    | Direct messages between staff and nurses |

Schemas are defined in `src/types/index.ts` and the typed `CollectionReference`s live in `src/lib/collections.ts`.

## Security rules

`firestore.rules` and `storage.rules` ship with a baseline "must be signed in" policy. Tighten these per role (admin / coordinator / nurse / facility) before going to production. Deploy with:

```bash
firebase deploy --only firestore:rules,storage
```

## Scripts

- `npm run dev` – start the dev server
- `npm run build` – production build
- `npm run start` – run the production server
- `npm run lint` – ESLint via `next lint`
