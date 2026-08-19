# xyz.com ERP + LMS — Student & Teacher app (React Native)

Mobile app for the **Student** and **Teacher** consoles of the xyz.com ERP + LMS.
It is a React Native (Expo + expo-router) port of those sides of the website in
`../fontend` — same screens, same design tokens, same API endpoints, so the
app UI matches the website UI one-to-one.

The website itself is unchanged. Other role apps (Hostel Warden, …) come later.

## Screens

### Shared

- **Login** — tenant login (institution code + email/roll number + password).
  Student accounts open the student console; teacher / mentor accounts open
  the teacher console. Accounts that hold both roles can switch from the
  drawer.

### Student (C-ST-01 … C-ST-20)

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

### Teacher (C-TC-01 … C-TC-22)

- **Dashboard** — today's periods, submissions to review, upcoming exams,
  pending leaves, notices, quick actions.
- **My schedule** — weekly teaching timetable for the teacher's subjects.
- **Mark attendance** — class/subject/date/period picker, P/A/L/E roster,
  all-present, save. Locked sessions stay read-only.
- **Attendance sessions** — filterable history, lock a session.
- **Leave requests** — approve or reject student leave for classes you teach.
- **Examinations** — list, create/edit draft, publish, question paper
  (MCQ / true-false / descriptive, import from the question bank), results
  and a dedicated grading screen that always shows the full question stem.
- **Question Bank** — list, add, edit, delete, CSV export and paste-import
  (website file-picker / print-to-PDF become share / paste on the phone).
- **Assignments** — list, create, publish / close / reopen, edit draft,
  milestone stages, group roster.
- **Project Teams** — group assignments, roster management, workspace
  (tasks, chat, links, members) and jump to the group submission.
- **Content** — library with hide/show/delete, upload a file key or link.
- **Notices** — board plus class-scoped composer.
- **Discussion** — threads, composer, replies, accept answer, pin / lock /
  delete.

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
- `<input type="date">` / `datetime-local` become `YYYY-MM-DD` and
  `YYYY-MM-DDTHH:MM` text fields.
- Hover-only affordances (tooltips, hover reveals) are dropped, as on the
  website's own mobile view.
- Print/save-as-PDF and CSV import-export buttons are omitted — the document
  itself is rendered identically where it exists.
- Exam grading is a full screen (not a modal overlay) so every question is
  readable.
