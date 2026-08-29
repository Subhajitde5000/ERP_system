# Parent Portal — Simple User Guide

This guide is for the grown-ups: **parents, guardians and anyone else the school has linked to a
student**. It also has a short section for the **school office** (who ever grants or removes the
access) and one for the **student** (whose record it is).

You do not need to be technical. Nothing here asks you to install or configure anything.

> Want the engineering detail instead — tables, endpoints, how access is enforced? That is
> `System.md`, "ERP + LMS — Parent–Student Connected Access". This file is only about using it.

---

## 1. What the Parent Portal is

It is your own window into **one child's** school record: today's classes, attendance, leave,
timetable, exams, marks, assignments, notices and fees.

Three things it is **not**:

| It is not | Because |
|---|---|
| Your child's account | You never log in as your child, and you cannot do their work for them |
| A two-way inbox | You can *read* almost everything and *write* one thing: a leave application |
| A payment counter | Fees are shown, never collected. Paying happens at the school, the way the school asks |

One adult can be linked to several children. One child can have several linked adults. What each
adult sees is decided **per child, per adult**, by the school — so it is normal for a mother and a
father to have different menus, and normal for you to see fees for one child and not another.

---

## 2. Step 0 — Open your account (once)

You need the **activation slip** the school gave you at admission. It has:

* an **activation code** — 12 characters, printed in blocks, e.g. `7QK4M2XB9RTD`
* your **child's roll number**

### On a computer or phone browser

1. Open the link printed on the slip, or type your school's address and add `/guardian-access`:
   `https://green.xyz.com/guardian-access`
2. Type the code. Spaces and dashes do not matter — they are removed for you, and letters are
   capitalised.
3. Type your child's roll number. This is a second check: without it, a code picked up off a desk
   gives nobody access to anything.
4. *(Optional)* Press **Check the invitation first**. The screen will tell you whose child it is —
   name, class, and whether you are the primary guardian — before you create anything. Worth doing
   if the family has more than one slip.
5. Enter your name, email and phone, then choose a password of **at least 10 characters** (twice).
6. Press **Create account and link**. Then **Sign in**.

You are signed in to your child's record immediately. No waiting for the school.

### On the mobile app

The app asks for the **institution code** first (for Green Public School, that is `green`), then the
same form. After activation the app already knows your school, so **Sign in** is one tap.

### If it does not work

| The screen says | It means | What to do |
|---|---|---|
| "Invitation code not found…" | Typo, or the code was already used | Retype it carefully. The letters **I, L, O and U are never used** in a code, so every `0` is a zero and every `1` is a one. If it still fails, ask the office to reissue |
| "This invitation has expired." | Codes last **14 days** | The office can issue a fresh one in a minute |
| "The roll number does not match this invitation" | Right code, wrong roll number (or the other way round) | Check both against the slip |
| "An account already uses this email…" | You already have a portal account | **Sign in** with that account, open **My details**, and enter the code there. You do not need a second account |
| "Too many attempts…" | The server allows 20 code lookups and 8 account creations per hour per device | Wait an hour, or ask the office |

---

## 3. Signing in afterwards

| | Where |
|---|---|
| **Web** | `https://<school>.xyz.com/login` → your email and password → you land on **My family** |
| **App** | Open the app → school code (e.g. `green`) → Sign in → you land on **My family** |

Forgot the password? Use **Forgot password?** on the login page — your portal account is an ordinary
school account, so the same reset link works.

If your access is closed while you are reading something on screen, the next request says
"Your access to this student is no longer active. Contact the school office." That is the school
changing the record, not a bug on your phone.

---

## 4. The menu, and what each screen gives you

| Menu item | What is there |
|---|---|
| **My family** | Every child linked to you, each with what you may open for them; invitations waiting to be claimed |
| **Today** | Was my child at school today, today's periods, what work is due, latest notices, who to contact |
| **Attendance** | Overall %, present / absent / late / excused, per-subject breakdown, and a month calendar you can tap day by day |
| **Leave** | Absence requests you or the child filed — and the one thing you can send |
| **Timetable** | The class routine with teachers and rooms; a room change appears here |
| **Exams & results** (web) / **Examinations** + **Results** (app) | Exam dates, and the mark for each once the school publishes it; published term cards with subject-by-subject scores |
| **Assignments** | What is set, what was handed in, what it scored |
| **Notices** | The circulars addressed to your child's class or the whole school |
| **Fees** | Balance, instalments and due dates, receipts, and any concession or scholarship applied |
| **My details** | Your phone and address, what the school shares with you, and a box to claim another child |

Items you do **not** have are not hidden in a corner — they are not in the menu at all, and if you
type the address of a missing screen you get a short explanation instead of data. Both are the
school's setting, not a fault on your device.

---

## 5. Two or more children

Your child's name is in the **top bar** on both web and app.

* Tap (or click) it and you get the list of children linked to you.
* Pick one. Every screen you open after that is about **that** child, and the address bar on the web
  remembers it (`?child=…`), so you can bookmark "Aarav's fees".
* A child whose access is paused or ended is listed but greyed out, with the reason shown. It is
  deliberately not hidden — you should be able to see that the record exists and why it is closed.

Same school, second child, new code? Open **My details → Another child at this school?**, type the
code, and the child is added to the account you are already using.

Different school? That is a different login. Schools do not share one guardian account, on purpose.

---

## 6. Reading the numbers the way the school means them

**Attendance.** Marked per period by the subject teacher, not per day. So "absent for one period" and
"absent all day" are different lines, and both are visible when you tap the day in the month view.
Ask your child *why* before you act — a cancelled period can look like an absence until the teacher
marks it.

**Was my child at school today?** The **Today** screen's attendance tile answers it: it shows the last
mark the school made ("Last mark Present · 30 Aug"), or the number of sessions marked if nothing has
been recorded yet. "Nothing marked yet" is not the same as "absent" — a period can be marked in the
evening, or on the next day.

**Marks.** Two things publish a mark: the exam's own result, and the term **result card**. A mark can
therefore exist before the card does. If a card shows nothing, the school has not published it — not
that the child scored nothing.

You see the score, the total, the percentage, the grade and whether it passed. You do **not** see the
answered paper. Reading question-by-question is your child's own screen, and the school decides
whether that opens before or after review — this is on purpose, so a half-marked script is not
discussed at the dinner table before the teacher has finished with it.

**Rank** is inside the class, not the year, and only appears when the school publishes it.

**Fees.** The number you see is the accounts department's number, exactly. If you have paid and dues
still show, the payment has not been matched to a receipt yet — take the **receipt number** to the
office and it is fixed on this same screen. The **Balance** tile is the only one that matters in a
hurry; "Waived" is money the school has already taken off, not money you must claim.

**Notices** are what your child's class was addressed. A circular for another section never appears
here. There is no "mark as read" button for you, because the read tick measures whether the *student*
looked — ticking it from a parent account would falsify a number the school uses.

---

## 7. Applying for leave (the one thing you can send)

Go to **Leave → Request leave** (web: *Apply for leave on behalf of your child*).

| Field | What to write |
|---|---|
| **From / To** | Dates as `YYYY-MM-DD`. Same date for one day |
| **Reason** | What happened and what proof exists. "Fever since last night; clinic visit at 4pm" is useful; "unwell" is not |
| **Document link** | Optional — a clinic or travel link |

The rules, so you are not surprised by a refusal:

* up to **30 days** per application;
* the end date cannot be before the start date;
* no second application that overlaps a pending or approved one — for the same child;
* **absences starting more than a week ago cannot be filed here.** A late condonation is an office
  decision on paper, not a form;
* it goes to the **class teacher** for review. It is never auto-approved: an attendance record is a
  legal document, not a message.

Each request in your list carries a tag — **Filed by you**, **Filed by another guardian**, or **Filed
by the student** — which is the answer to "did the other parent already send this?". Teachers see the
same distinction, so they know who to call back. You may **withdraw** an application while it is still
pending, and only if you were the one who filed it: a request your child sent themselves is theirs to
cancel, not yours. Once a teacher has decided, the answer stands: reopen it with the office rather
than sending a second copy.

---

## 8. Your own details

**My details** shows your name, email, phone and how many children are linked.

* You can change your **phone** and **address**.
* You cannot change your **name**. It is printed from the admission record and quoted in the audit
  trail, so it is changed by the office with documents.
* The phone on this screen is the number alerts go to. Saving a new number clears its verified status,
  so confirm it when the school asks — otherwise absence messages may go to the old number.
* The same screen lists, per child, exactly which areas the school has granted you. A second guardian
  of the same child may legitimately hold a different list.

---

## 9. When something looks wrong

| What you see | Most likely reason | What to do |
|---|---|---|
| A menu item is missing | That module was not granted for this child | Ask the office; nothing else you can see changes |
| "The school has not granted guardians access to … for this student." | Same, but you reached the screen another way (a bookmark, a shared link) | Same |
| Empty list everywhere | The school has not marked anything yet, or published nothing yet | Wait a day; then ask the class teacher |
| "This student has no active enrolment for the current academic year, so there is no record to show." | The enrolment lapsed — a promotion not yet done, or a fee hold | The office fixes the enrolment; the portal opens again by itself |
| "Access ended on …" | The school set an end date and it passed | Ask for an extension before it lapses if you need continuity — the portal keeps reading history but shows nothing new after |
| The child's own app shows something yours does not | Some records are the student's alone (answered papers, submissions, the signed grade-card PDF) | Normal. The office can print a grade card |
| Your phone shows a different child than expected | The console remembers the last child you opened | Tap the name in the top bar and pick |
| A result card exists but the PDF is nowhere here | Parents do not get the signed-document download | Ask the office; they issue it from the student record |

If you genuinely believe a number is wrong — an attendance day, a mark, a fee — the fix is always with
the class teacher or the accounts desk. Editing from a parent account is not possible by design, so
that any change carries a staff member's name.

---

## 10. For the school office — granting and removing access

Web: **Admin console → Guardians** (`https://<school>.xyz.com/admin/guardian-links`).

### Link a guardian (one form, three shapes)

1. Choose the student (search the roster by name, roll number or class).
2. Choose how the adult gets access:
   * **Send an activation code** — the link waits as *pending*; the family sets their own password.
     This is the usual one; it costs the office no passwords.
   * **Create the login now** — an account is made and a set-password email is sent, the way staff
     invites work. Use it when the guardian cannot use email links.
   * (An existing guardian account can be attached by id through the API; in practice, issue them a
     code and they claim it from **My details**, which adds the sibling to the account they already have.)
3. Set the relation, tick **primary** if this is the main contact, and tick the modules.
4. Send. The code appears **once**, in a dialog. Copy it, or read it aloud and write it on the slip.
   It is not shown again after that dialog — reissue instead of searching for it.

### What each module gives the family

| Module | The family can open |
|---|---|
| Attendance | Presence, the month calendar — **and filing leave for the child** |
| Timetable | The class routine |
| Examinations | Exam dates, and each mark once published |
| Assignments | The list, what was submitted, the score |
| Results | Published term cards |
| Notices | The child's notice board |
| Fees | Balance, instalments, receipts, concessions |

Two habits that avoid 90% of disputes:

* **Leave `Fees` off unless it belongs on.** It is the one number a shared phone or a sibling's
  laptop should not show. Keep it off for a court order that names one parent, and off for
  grandparents. It is a per-adult switch, so the other parent can still have it.
* **Exactly one primary per student.** Primary decides who gets attendance alerts and fee reminders.
  Ticking a second one moves the flag — the previous primary is demoted in the same save, which is
  why it does not fail with a database error.

### Suspend, or unlink?

| Action | Effect | Use it for |
|---|---|---|
| **Suspend** | The family stops seeing new data at once; their links stay listed with "Paused by the school"; you can restore | A dispute, a fee hold, a pending custody question |
| **Unlink** | Access removed for good; the history stays in the audit trail | A relationship that has ended, a wrong entry, a student who left |
| **End date** (`Access ends`) | Access stops on that day, on the school's own calendar | A fixed order, a term-limited arrangement |

Every one of those writes an audit row — who created, edited, suspended, unlinked or reissued, and
when — because "who removed this grandfather's access, and when" is the first question asked. The
**Note for the office** field on the same form is where the reason goes (custody orders, "mother has
no fee access per order dated …"). Staff-only; the family never sees it.

### The gap worth watching

The top of the board shows **students with no guardian at all**, and a warning when a child has linked
adults but **no active primary contact** (then alerts have no recipient). Those two numbers are the
board's real job — a portal nobody was given access to is not a portal.

### Codes: do and don't

* **Do** hand the slip to the person named on it, or email the code to the address recorded on the
  link, or use **Send code** on a pending row to email a fresh one (the old one stops working
  immediately).
* **Don't** paste a code into a URL, a group chat, or a shared spreadsheet. It is a key, not an ID.
* **Don't** re-issue "just to check" while the family is at the counter — that kills the code they are
  holding. Look the row up and read the state instead.
* Guardian access is offered to **school** tenants. A college tenant sees an explanation, not an
  empty table; its students hold their own accounts. Existing college links stay readable and
  removable so a tenant that changed type can clean up.

---

## 11. For students — what your guardians can see

* They see what the school granted them: usually attendance, timetable, notices, sometimes marks and
  fees. The school decides, and can decide differently for each of your parents.
* They **cannot**: submit your assignments, open your answered papers, download your signed grade
  card, mark your notices as read, or change anything on your record.
* They **can** file a leave for you and cancel one they filed — and you will see it in your own leave
  list marked as coming from your parent, because the teacher needs to know who asked.
* Nothing your parent can see was hidden from you; usually it is the reverse.

If something on their screen looks wrong to you, tell the class teacher — the same route as everything
else.

---

## 12. Staying safe

* Your code is only yours, and only until it is used. Once it works, it is gone from the system.
* One account, one family. Do not share your password with a relative who wants to "just look at the
  fees" — ask the office to link them, and they can be given attendance and notices only.
* This portal never asks for a card number, a UPI PIN, or a payment. A message that does is not from
  your school.
* Sign out on a shared device. On the app: the drawer at the top left → **Sign out**.

---

## 13. Questions people actually ask

**Can I see my child's attendance live, minute by minute?** No — the teacher marks attendance per
period, usually by the end of the day.

**Why does my co-parent have fees and I don't?** The school set it per adult, often because of a
document they hold. They can change it; you can ask.

**My child changed school. Do I lose access?** Your access follows the enrolment at that school. A
new school means a new slip and a new account there.

**Can I get a PDF of the result card?** Not from here — the signed card is issued by the office, from
your child's record.

**Do I need to renew anything?** Check **My family**: a tile like "12 days of access left" appears
when the school set an end date. Ask for an extension before it runs out.

**Is there an app?** Yes — the same xyz.com app, signed in with your guardian account. It has the same
screens, including leave filing.

**I entered the code wrongly a few times. Did I lock my child out?** No. Lookups are limited per
device per hour, and after an hour you can try again. The link itself is untouched until someone
successfully claims it.

---

_Screens, labels and rules in this guide match the current build: the `/parent/**` web console,
`(parent)` mobile group, the public `/guardian-access` activation, and the Admin → Guardians board.
Engineering reference: `System.md`._
