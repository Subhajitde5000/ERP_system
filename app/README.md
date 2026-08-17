# xyz.com ERP + LMS — Student app (React Native)

Mobile app for the **Student** console of the xyz.com ERP + LMS. It is a
React Native (Expo + expo-router) port of the student side of the website in
`../fontend` — same screens, same design tokens, same API endpoints, so the
app UI matches the website UI one-to-one.

> Teacher, Hostel Warden and the other role apps come next; this app only
> contains the student side (C-ST-01 … C-ST-20).

## Screens (identical to the website's student console)

- **Login** — tenant login (institution code + email/roll number + password),
  same welcome card, branding banner and validation as `/login` on the web.
- **Dashboard** — attendance, upcoming exams, pending assignments, fee
  balance, today's periods, next exam, recent notices, quick links.
- **Profile** — student record; name / phone / photo are editable.
- **Attendance** — overall + per-subject summary, leave requests, monthly
  calendar, apply-for-leave form.
- **Timetable** — Monday–Saturday period grid with teachers and rooms.
- **Examinations** — list, instructions with countdown, timed attempt with
  autosave (backgrounding the app reports the anti-cheat tab-switch signal),
  result with answer review.
- **Assignments** — list, brief, milestone chain, group formation
  (create/join/reuse/leave), submit/resubmit with files, submission history
  with file preview.
- **Project Teams** — invitations, team metrics, and the team workspace
  (task board, team chat, shared links, roster, submission overview).
- **Content** — library with subject/chapter/type filters, inline viewer.
- **Results** — published results, subject-wise detail, grade card.
- **Notices** — notice board with unread marking.
- **Discussion** — question threads, composer, replies and upvotes.
- **Fees** — fee account, installments, scholarships, payment history and
  official receipts.

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Point the app at the FastAPI backend (defaults to `http://localhost:8000`,
   the same default as the website). Create `.env.local` if needed:

   ```bash
   EXPO_PUBLIC_API_URL=http://<backend-host>:8000
   ```

3. Start the app

   ```bash
   npx expo start
   ```

   Open it in Expo Go / a dev build, or press `w` for the web preview.

## Notes on mobile-specific adaptations

The app reuses the website's exact palette, typography sizes, radii, shadows,
labels and empty states (see `src/theme.ts`). Only where a browser feature
has no native counterpart is it adapted:

- `<select>` dropdowns become bottom-sheet pickers.
- Browser `confirm()` becomes native alert dialogs.
- `<input type="date">` becomes a `YYYY-MM-DD` text field.
- Hover-only affordances (tooltips, hover reveals) are dropped, as on the
  website's own mobile view.
- Print/save-as-PDF buttons (grade card, receipt) are omitted — the document
  itself is rendered identically.
