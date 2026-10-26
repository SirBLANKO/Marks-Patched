# Marks

Section marks for one course. Students sign in and see their own scores. The TA sees the whole section and can enter a mark.

Express, a static page, and a JSON store. Auth is a JWT.

## Features

- Sign in, token stored in the browser
- Student view of their own labs and midterm
- TA section view
- TA can post a new mark
- Health check at `/api/health`

## Run locally

Node 18+.

Install dependencies with `npm ci`. Before starting, set a unique `JWT_SECRET`
(at least 32 bytes) and, for a new database, `INITIAL_TA_PASSWORD` (at least 16
characters, at most 72 UTF-8 bytes). There is no built-in signing secret or TA password.

In Windows PowerShell, from the folder containing `package.json`:

```powershell
npm.cmd ci
$env:JWT_SECRET = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
$env:INITIAL_TA_PASSWORD = node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
$env:INITIAL_TA_PASSWORD
npm.cmd start
```

Save the displayed initial password privately; it is the password for `priya`.
These environment variables last for this terminal session. Save the signing
secret privately too if you want existing tokens to survive a restart. Changing
the signing secret signs everyone out. Restarting with a different initial TA
password does not change an existing account's password.

On macOS/Linux, set the same variables using `export` before `npm start`.
Plain `npm start` does not automatically load `.env`. Docker Compose reads `.env`
for its variable substitutions; Render uses variables configured in its dashboard.

Open http://localhost:3000. The default local store is `lib/data/marks.json`
(the original application's actual default, retained to preserve existing data).
`DATABASE_PATH` overrides it; Docker uses `/app/data/marks.json`.

## Run with Docker

Copy `.env.example` to `.env` and fill in privately generated values for both
secrets before creating a new Docker database. Do not commit `.env`.

```bash
docker compose up --build
```

The app listens on port 3000.

## Demo accounts

Sign in with the username.

| Username | Password | Role |
|---|---|---|
| `maya` | `campus123` | student |
| `devon` | `campus123` | student |

The TA username is `priya`; use the private password supplied when the database
was first created. The two student accounts remain public classroom demo accounts.
Do not put real student records in these shared accounts.

## Project layout

```
server.js            Routes
lib/tokens.js        JWT sign and verify
lib/store.js         JSON store and seed
public/              Sign-in page and grade table
```

## API

| Method | Path | Who |
|---|---|---|
| POST | `/api/login` | anyone |
| GET | `/api/me` | signed in |
| GET | `/api/students/:id` | that student or the TA |
| GET | `/api/section` | TA |
| POST | `/api/grades` | TA |

Send `Authorization: Bearer <token>` after login.

## Existing installations

Rotate `JWT_SECRET` to invalidate previously issued or forged tokens. The server
now checks the account's current stored role rather than trusting the token's role.
For an existing database, stop the server and reset the old seeded TA password:

```powershell
$env:NEW_TA_PASSWORD = node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
$env:NEW_TA_PASSWORD
node scripts/reset-ta-password.js priya
```

Save the new password privately and use the same `DATABASE_PATH` as the running
app. Back up the JSON store first. This command preserves grades and other users.
It does not run automatically or overwrite passwords on each startup.

## Verification

Run `npm test`. The 11 regression tests cover normal student and TA access,
cross-student access denial, forged/expired/malformed tokens, current-role checks,
initial credentials, existing-database password reset, and escaped HTML rendering.
Tests create a separate temporary database and do not modify the application store.

## Hosting

Set `JWT_SECRET` and `INITIAL_TA_PASSWORD` in the hosting service's environment
settings. Preserve `DATABASE_PATH` on durable storage if data must survive restarts.
Free hosting with an ephemeral filesystem is suitable only for disposable demo data.
No hosted deployment was performed or verified as part of this patch.

## Assignment notes

Host this somewhere your classmates and instructor can reach. Walk the running app until you can explain:

- what the login response contains, and where the browser keeps it
- which requests send that value back
- what a student can see versus what the section view is for
- what is inside `data/marks.json` after the first request

Then look for a security defect in the running system, document how to trigger it, and patch it without breaking normal sign-in. Submit the hosted URL, a short architecture sketch, the writeup, and the patched repo.
