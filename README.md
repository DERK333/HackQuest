# HackQuest

```
  ██╗  ██╗ █████╗  ██████╗██╗  ██╗ ██████╗ ██╗   ██╗███████╗███████╗████████╗
  ██║  ██║██╔══██╗██╔════╝██║ ██╔╝██╔═══██╗██║   ██║██╔════╝██╔════╝╚══██╔══╝
  ███████║███████║██║     █████╔╝ ██║   ██║██║   ██║█████╗  ███████╗   ██║
  ██╔══██║██╔══██║██║     ██╔═██╗ ██║▄▄ ██║██║   ██║██╔══╝  ╚════██║   ██║
  ██║  ██║██║  ██║╚██████╗██║  ██╗╚██████╔╝╚██████╔╝███████╗███████║   ██║
  ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝ ╚══▀▀═╝  ╚═════╝ ╚══════╝╚══════╝   ╚═╝
                         ethical hacking · trained, not guessed
```

<p align="center">
  <strong>Interactive cybersecurity training.</strong> CTF rooms, learning paths, attack simulators, quizzes, and a live community — in the browser and on Android.
</p>

<p align="center">
  <a href="https://hack-quest.com/"><img src="https://img.shields.io/badge/live-hack--quest.com-00ff9f?style=for-the-badge&labelColor=0b0f14" alt="Live site" /></a>
  <img src="https://img.shields.io/badge/stack-React%20%2B%20Vite-61dafb?style=for-the-badge&labelColor=0b0f14" alt="React + Vite" />
  <img src="https://img.shields.io/badge/mobile-Capacitor%20Android-46eb8a?style=for-the-badge&labelColor=0b0f14" alt="Capacitor Android" />
  <img src="https://img.shields.io/badge/license-open%20source-a78bfa?style=for-the-badge&labelColor=0b0f14" alt="Open source" />
</p>

<p align="center">
  <a href="https://hack-quest.com/">Open the platform</a>
  ·
  <a href="#-quick-start">Quick start</a>
  ·
  <a href="#-what-you-can-do">Features</a>
  ·
  <a href="#-architecture">Architecture</a>
</p>

---

## Why HackQuest

Most cybersecurity courses stop at slides. HackQuest is built for people who learn by **doing**: walk a path, enter a room, fire a simulated attack, defend, quiz yourself, then talk it through with the community.

It is a **work in progress** and open to remix. Use it to train, teach, or fork into your own lab.

> Train like an operator. Stay on the right side of the keyboard. This project is for **ethical hacking and defensive education only**.

---

## What you can do

| Surface | What it is |
| --- | --- |
| **Dashboard** | Streaks, stats, featured paths, threat feed, and “for you” recommendations |
| **Learning paths** | Guided roadmaps with materials, checkpoints, and assessments |
| **CTF rooms** | Hands-on rooms with tasks, comments, and progress |
| **Quiz engine** | Timed knowledge checks, bookmarks, and lab links |
| **Attack simulator** | Scenario-driven offense / defense with logs and reports |
| **Sandbox** | Terminal, topology, attack chains, incident response, session replay |
| **MITRE builder** | Technique chains, difficulty, and target config |
| **Skill tree** | Visual mastery map and next-path suggestions |
| **Leaderboard** | Compete on performance, not vibes |
| **Community** | Discussions, replies, and upvotes |
| **Certificates** | Generated after you earn them |

Auth covers login, register, password reset, and OAuth (Google / Apple / Microsoft). Payments are wired through Stripe. The Android shell is Capacitor (`com.derk333.hackquest`).

---

## Stack

```
┌─────────────────────────────────────────────────────────────┐
│  React 18  ·  Vite 6  ·  Tailwind  ·  Radix UI  ·  Framer   │
│  React Query  ·  React Router  ·  xterm.js  ·  Three.js     │
└────────────────────────────┬────────────────────────────────┘
                             │
              ┌──────────────▼──────────────┐
              │     Base44 SDK + functions  │
              │  entities · auth · email    │
              └──────────────┬──────────────┘
                             │
         ┌───────────────────┴───────────────────┐
         │  Web: hack-quest.com                  │
         │  Native: Capacitor → Android          │
         └───────────────────────────────────────┘
```

**Frontend:** React, Vite, Tailwind CSS, Radix/shadcn-style UI, Framer Motion, TanStack Query, React Router, xterm, Three.js, Recharts, Stripe.

**Backend (Base44):** courses, rooms, quizzes, badges, progress, discussions, attack logs, Gmail enrollment sync, certificates, indexing monitor, terminal execute.

**Mobile:** Capacitor 8 Android project in `android/`.

---

## Quick start

```bash
npm install
```

Create `.env.local` in this folder:

```env
VITE_BASE44_APP_ID=your_app_id
VITE_BASE44_APP_BASE_URL=https://base44.app
```

```bash
npm run dev
```

Then open the local Vite URL (usually `http://localhost:5173`).

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local development server |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check via `jsconfig.json` |

### Android (optional)

```bash
npm run build
npx cap sync android
npx cap open android
```

---

## Repo layout

```
hack-quest/
├── src/
│   ├── pages/           # Dashboard, Rooms, Paths, Sandbox, Quiz…
│   ├── components/      # layout, sandbox, simulator, quiz, UI kit
│   ├── lib/             # auth, badges, attack scenarios
│   └── api/             # Base44 client
├── base44/
│   ├── entities/        # data models
│   └── functions/       # server functions (certs, quizzes, terminal…)
├── android/             # Capacitor native project
├── public/              # SEO, sitemap, 404, robots
├── index.html
├── package.json
└── capacitor.config.ts
```

---

## Architecture

HackQuest is a **single-page app**. Pages under `src/pages/` are the product surface. Shared chrome (sidebar, top nav, bottom nav, search) lives in `src/components/layout/`.

**Sandbox & simulator** pieces are isolated: terminals, topology, attack panels, MITRE chains, and PDF/report export. They talk to Base44 functions for persistence (attack logs, quiz attempts, enrollments) rather than embedding a real attacker toolchain.

**Entities** worth knowing: `User`, `LearningPath`, `Room`, `Quiz`, `QuizAttempt`, `CourseProgress`, `Badge`, `Discussion`, `AttackLog`, `CustomScenario`.

---

## Status

This is an active build. Expect sharp edges: not every flow is fully polished yet. Issues and remixes are welcome.

| Area | State |
| --- | --- |
| Web training platform | In progress |
| Android wrapper | Present (Capacitor) |
| Content / indexing | Backend functions exist |
| Docs | You are here |

---

## Support

- **Live:** [hack-quest.com](https://hack-quest.com/)
- **Docs:** [blog.theweb3tech.com](https://blog.theweb3tech.com)
- **Email:** [drsamuel@linuxmail.org](mailto:drsamuel@linuxmail.org)
- **Form:** [contact form](https://forms.gle/BejbApBohRXPwWQk9)
- **Publish / iterate with AI:** [base44.com](https://base44.com)

Originally edited and created on [Base44](https://base44.com). Open source — remix it.

---

<p align="center">
  <sub>HackQuest · learn the craft · leave the network better than you found it</sub>
</p>
