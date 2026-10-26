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

```bash
npm install
npm start
```

Open http://localhost:3000. Data is created on first request at `data/marks.json`.

## Run with Docker

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
| GET | `/api/students/:id` | signed in |
| GET | `/api/section` | TA |
| POST | `/api/grades` | TA |

Send `Authorization: Bearer <token>` after login.

## Assignment notes

Host this somewhere your classmates and instructor can reach. Walk the running app until you can explain:

- what the login response contains, and where the browser keeps it
- which requests send that value back
- what a student can see versus what the section view is for
- what is inside `data/marks.json` after the first request

Then look for a security defect in the running system, document how to trigger it, and patch it without breaking normal sign-in. Submit the hosted URL, a short architecture sketch, the writeup, and the patched repo.
