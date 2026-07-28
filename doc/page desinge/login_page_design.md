# Login Page Design — xyz.com ERP + LMS Platform
> Premium, Simple, Multi-Tenant Ready | Next.js 14 + Tailwind + shadcn/ui

---

## 1. Overview
This design is for the **main login page** of xyz.com — a multi-tenant ERP + LMS platform with 22 roles and 15 modules. It must work for:
- `app.xyz.com` → Platform roles (Super Admin, Support, Sales, Finance)
- `abc-college.xyz.com` → Institution roles (Admin, Principal, HOD, Teacher, Student, Parent, etc.)

Goal: Simple, premium, trustworthy, fast to build.

---

## 2. Final Premium Color Combination (Simple — Only 4 Colors)

### RECOMMENDED — "Royal Indigo" (Trust + Education + Premium SaaS)

| Role | Color Name | HEX | Usage |
|------|------------|-----|-------|
| **Primary** | Slate 900 | `#0F172A` | Headings, left branding panel background, primary text |
| **Accent** | Indigo 600 | `#4F46E5` | Primary button, links, focus ring, active states |
| **Accent 2** | Cyan 500 | `#06B6D4` | Hover glow, secondary highlight, student/parent badge |
| **Background** | Slate 50 / White | `#F8FAFC` / `#FFFFFF` | Page background / Card background |

#### Supporting Neutrals (not counted as main colors, but needed)
| Token | HEX | Usage |
|-------|-----|-------|
| Text Secondary | `#64748B` | Labels, placeholders |
| Border | `#E2E8F0` | Input border, card border |
| Error | `#EF4444` | Error text |
| Success | `#10B981` | Success check |
| Warning | `#F59E0B` | Low attendance warning |

> **Why this works:** Slate 900 = premium institution feel. Indigo = education + tech + trust. Cyan = modern, youthful for students. 4-color system = very easy for all 3 developers to maintain consistency across 15 modules.

#### Alternative Option (if you want warmer premium)
- Primary: `#1E1B4B` (Indigo 950)
- Accent: `#7C3AED` (Violet 600)
- Background: `#F5F3FF` (Violet 50) / `#FFFFFF`

---

## 3. CSS Variables (Paste in `globals.css`)

```css
/* app/globals.css */
:root {
  /* Premium Palette */
  --background: 210 40% 98%; /* #F8FAFC */
  --foreground: 222 47% 11%; /* #0F172A */
  
  --card: 0 0% 100%; /* #FFFFFF */
  --card-foreground: 222 47% 11%;
  
  --primary: 222 47% 11%; /* Slate 900 - for dark branding panel */
  --primary-foreground: 210 40% 98%;
  
  --accent: 239 84% 67%; /* #4F46E5 Indigo 600 - main CTA */
  --accent-foreground: 0 0% 100%;
  
  --accent-2: 188 94% 43%; /* #06B6D4 Cyan */
  
  --muted: 210 40% 96.1%;
  --muted-foreground: 215 16% 47%; /* #64748B */
  
  --border: 214 32% 91%; /* #E2E8F0 */
  --input: 214 32% 91%;
  --ring: 239 84% 67%; /* Indigo focus */
  
  --destructive: 0 84% 60%; /* #EF4444 */
}

.dark {
  --background: 222 47% 11%;
  --foreground: 210 40% 98%;
  --card: 222 47% 11%;
  --border: 217 32% 17%;
}
```

### Tailwind Config

```js
// tailwind.config.ts
colors: {
  border: "hsl(var(--border))",
  input: "hsl(var(--input))",
  ring: "hsl(var(--ring))",
  background: "hsl(var(--background))",
  foreground: "hsl(var(--foreground))",
  primary: {
    DEFAULT: "#0F172A",
    foreground: "#F8FAFC",
  },
  accent: {
    DEFAULT: "#4F46E5", // Indigo 600
    hover: "#4338CA",   // Indigo 700
    light: "#EEF2FF",   // Indigo 50
    foreground: "#FFFFFF",
  },
  secondary: {
    DEFAULT: "#06B6D4",
    light: "#ECFEFF",
  },
  muted: {
    DEFAULT: "#F1F5F9",
    foreground: "#64748B",
  }
}
```

---

## 4. Typography
- **Heading:** `Plus Jakarta Sans` or `Inter` — Bold 700 — `#0F172A`
- **Body:** `Inter` — Regular 400 — `#0F172A` / `#64748B`
- **Label:** `Inter` — Medium 500 — 14px — `#334155`
- **Button:** `Inter` — SemiBold 600 — 14px

Import:
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@700&display=swap" rel="stylesheet">
```

---

## 5. Layout Concept (Split Screen Premium)

```
+--------------------------------+--------------------------------+
|                                |                                |
|   LEFT PANEL (Branding)        |   RIGHT PANEL (Login Form)     |
|   Background: #0F172A          |   Background: #FFFFFF          |
|   Width: 45% desktop           |   Width: 55% desktop           |
|                                |                                |
|   - xyz.com logo (white)       |   - Institution logo (from     |
|   - Big headline:              |     tenant slug)               |
|     "One Platform for           |   - Welcome back text          |
|      Your Entire Institution"  |   - Role badge (auto-detect)   |
|   - Illustration / pattern     |   - Email input                |
|     (subtle indigo gradient)   |   - Password input + show/hide |
|   - Testimonial / stats:       |   - Remember me + Forgot link  |
|     "500+ Institutions Trust Us"|   - Login button: #4F46E5      |
|   - Bottom: © xyz.com          |   - Divider: "or continue"     |
|                                |   - SSO if enabled             |
|                                |   - Footer help link           |
+--------------------------------+--------------------------------+
| Mobile: Only Right Panel shows, Left becomes top banner with gradient |
+------------------------------------------------------------------------+
```

---

## 6. Component Specifications

### 6.1 Card / Form Container
- Width: 400px max (centered)
- Background: `#FFFFFF`
- Border: `1px solid #E2E8F0`
- Radius: `16px` (`rounded-2xl`)
- Shadow: `0 4px 24px rgba(15, 23, 42, 0.06)`
- Padding: `32px` desktop, `24px` mobile

### 6.2 Input Field
- Height: `44px`
- Border: `1px solid #E2E8F0`, Radius `10px`
- Focus: Border `#4F46E5`, Ring `0 0 0 3px rgba(79, 70, 229, 0.15)`
- Placeholder: `#94A3B8`
- Label top: 14px Medium `#334155`
- Error: Border `#EF4444`, Message 12px `#EF4444`

### 6.3 Primary Button (Login)
- Background: `#4F46E5`
- Hover: `#4338CA`
- Active: `#3730A3`
- Text: White, 14px Semibold
- Height: `44px`, Radius `10px`
- Shadow: `0 4px 14px rgba(79, 70, 229, 0.25)`
- Loading: Spinner white

```tsx
// Example Button classes
className="w-full h-11 bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold rounded-[10px] shadow-[0_4px_14px_rgba(79,70,229,0.25)] transition-all"
```

### 6.4 Left Branding Panel Gradient
```css
background: radial-gradient(120% 120% at 0% 0%, #4F46E5 0%, #0F172A 60%);
```
Add subtle pattern dots: `opacity: 0.1` white dots.

---

## 7. Login Page States

| State | Design |
|-------|--------|
| Default | Clean inputs, indigo button |
| Focus | Indigo ring around input |
| Error | Red border + message "Invalid email or password" |
| Success | Green check, redirect to role dashboard |
| Tenant Not Found | Message: "Institution not found. Check subdomain." (for `xyz-college` typo) |
| Module Disabled | If user role from disabled module tries to login → redirect with "Contact admin" |
| Forgot Password | Link → `/forgot-password` page (same palette) |

---

## 8. Role-Aware Extras (Premium Touch)

After login API returns:
```json
{
  "user": {"name": "Rohan"},
  "roles": ["TEACHER"],
  "enabledModules": ["attendance","examination","assignment",...],
  "tenant": {"name": "ABC College", "logo_url": "...", "type": "COLLEGE"}
}
```

- Show tenant logo on top of form if exists, else xyz.com logo
- Show role chip: "Teacher Access" in `bg-[#EEF2FF] text-[#4F46E5]` pill
- Redirect:
  - `TEACHER` → `/teacher/dashboard`
  - `STUDENT` → `/student/dashboard`
  - `INSTITUTION_ADMIN` → `/admin/dashboard`
  - `SUPER_ADMIN` → `app.xyz.com/dashboard`

---

## 9. Complete Code — Next.js Login Page (Ready to Paste)

File: `apps/web/app/(auth)/login/page.tsx`

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, GraduationCap } from "lucide-react";

export default function LoginPage() {
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // TODO: Call POST /api/v1/auth/login with tenantId from subdomain
    // Use your api.ts client
    setTimeout(() => {
      setLoading(false);
      router.push("/dashboard");
    }, 1000);
  };

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      {/* LEFT PANEL - Desktop only */}
      <div className="hidden lg:flex lg:w-[45%] bg-[#0F172A] relative overflow-hidden flex-col justify-between p-10">
        {/* Gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_0%_0%,#4F46E5_0%,#0F172A_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px] opacity-[0.05]" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-white">
            <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-[#0F172A]" />
            </div>
            <span className="text-xl font-bold tracking-tight">xyz.com</span>
          </div>
        </div>

        <div className="relative z-10">
          <h1 className="text-[32px] font-bold leading-[1.2] text-white font-[Plus_Jakarta_Sans]">
            One Platform for <br />
            <span className="text-[#818CF8]">Your Entire Institution</span>
          </h1>
          <p className="mt-4 text-[#94A3B8] text-[15px] leading-6 max-w-[360px]">
            Attendance, exams, assignments, fees, hostel & more — trusted by 500+ schools and colleges across India.
          </p>
          
          <div className="mt-10 flex gap-6">
            <div>
              <div className="text-2xl font-bold text-white">500+</div>
              <div className="text-xs text-[#94A3B8]">Institutions</div>
            </div>
            <div className="w-px bg-white/10" />
            <div>
              <div className="text-2xl font-bold text-white">22</div>
              <div className="text-xs text-[#94A3B8]">Roles Supported</div>
            </div>
            <div className="w-px bg-white/10" />
            <div>
              <div className="text-2xl font-bold text-white">15</div>
              <div className="text-xs text-[#94A3B8]">Modules</div>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-white/40">
          © 2026 xyz.com · Secure, Multi-Tenant ERP + LMS
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-10 bg-white lg:bg-[#F8FAFC]">
        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-9 h-9 bg-[#0F172A] rounded-xl flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-[#0F172A]">xyz.com</span>
          </div>

          <div className="bg-white lg:border lg:border-[#E2E8F0] rounded-[16px] lg:shadow-[0_4px_24px_rgba(15,23,42,0.06)] p-0 lg:p-8">
            <div className="mb-7">
              <h2 className="text-[22px] font-bold text-[#0F172A]">Welcome back</h2>
              <p className="mt-1 text-[13px] text-[#64748B]">Sign in to your institution account</p>
            </div>

            {/* Tenant Badge - dynamic */}
            <div className="mb-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#EEF2FF] border border-[#C7D2FE]">
              <span className="w-2 h-2 rounded-full bg-[#4F46E5] animate-pulse" />
              <span className="text-[12px] font-medium text-[#4F46E5]">abc-college.xyz.com</span>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-[13px] font-medium text-[#334155]">Email or Roll Number</label>
                <input
                  type="text"
                  placeholder="you@college.edu or ROLL123"
                  className="mt-1.5 w-full h-11 px-3.5 rounded-[10px] border border-[#E2E8F0] bg-white text-[14px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#4F46E5] focus:ring-[3px] focus:ring-[#4F46E5]/15 transition"
                  required
                />
              </div>

              <div>
                <div className="flex justify-between">
                  <label className="text-[13px] font-medium text-[#334155]">Password</label>
                  <a href="/forgot-password" className="text-[12px] font-medium text-[#4F46E5] hover:text-[#4338CA]">Forgot?</a>
                </div>
                <div className="mt-1.5 relative">
                  <input
                    type={showPass ? "text" : "password"}
                    placeholder="••••••••"
                    className="w-full h-11 px-3.5 pr-10 rounded-[10px] border border-[#E2E8F0] bg-white text-[14px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#4F46E5] focus:ring-[3px] focus:ring-[#4F46E5]/15 transition"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B]"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 py-1">
                <input type="checkbox" id="remember" className="w-4 h-4 rounded border-[#CBD5E1] text-[#4F46E5] focus:ring-[#4F46E5]/20" />
                <label htmlFor="remember" className="text-[13px] text-[#475569]">Remember me for 7 days</label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-[#4F46E5] hover:bg-[#4338CA] active:bg-[#3730A3] disabled:opacity-60 text-white font-semibold text-[14px] rounded-[10px] shadow-[0_4px_14px_rgba(79,70,229,0.25)] transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </button>

              <div className="text-center text-[12px] text-[#64748B] pt-2">
                Having trouble? <a href="#" className="font-medium text-[#4F46E5]">Contact Institution Admin</a>
              </div>
            </form>
          </div>

          <div className="mt-6 text-center text-[11px] text-[#94A3B8]">
            Protected by tenant isolation · All logins are audited · <span className="text-[#0F172A] font-medium">v0.1.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## 10. Accessibility & UX Checklist

- [ ] Tab order: email → password → remember → login → forgot
- [ ] Enter key submits form
- [ ] Focus ring visible (`#4F46E5` 3px)
- [ ] Color contrast: `#0F172A` on white = 17:1 (AAA)
- [ ] Button contrast: white on `#4F46E5` = 6.2:1 (AA+)
- [ ] Password toggle has aria-label
- [ ] Error messages linked via `aria-describedby`
- [ ] Works at 320px, 768px, 1280px
- [ ] Loading state disables button to prevent double submit

---

## 11. How It Fits Your Project Plan

| File affects | Owner |
|--------------|-------|
| `apps/web/app/(auth)/login/page.tsx` | Dev-C C-06 |
| `apps/web/components/layout/Sidebar.tsx` | Use same `--accent` var |
| `apps/web/tailwind.config.ts` | Dev-C C-02 |
| `apps/web/app/globals.css` | Dev-C C-03 |
| Tenant detection via subdomain | Dev-A A-11 TenantMiddleware |

**Use same accent `#4F46E5` for:**
- Attendance Present = `#10B981` but header = `#4F46E5`
- Exam timer bar = `#4F46E5`
- Assignment stepper active = `#4F46E5`
- Notice pinned badge = `bg-[#EEF2FF] text-[#4F46E5]`

---

## 12. Quick Reference Card for Developers

```
Premium ERP + LMS Login
-----------------------
BG Page: #F8FAFC
Card: #FFFFFF border #E2E8F0 radius 16px shadow soft
Primary Text: #0F172A (Slate 900)
Secondary: #64748B (Slate 500)
Input: h-11 border #E2E8F0 focus #4F46E5
Button: #4F46E5 → hover #4338CA → text white → shadow indigo
Left Panel: #0F172A + radial gradient indigo #4F46E5
Font: Inter + Plus Jakarta Sans
```

---

*Created for xyz.com ERP + LMS — Team of 3 Devs — 18 Weeks Plan*  
*File version: 1.0 | Date: 2026-05-13 | Stack: Next.js 14, Tailwind, shadcn/ui, NestJS*
