# Marks: JWT forgery and broken access control

Marks is a classroom grade-viewing application built with Express, browser JavaScript, and a JSON file store. Students view their own scores and the teaching assistant can view the section and enter marks.

**Location:** `lib/tokens.js`, the `requireUser()` middleware, and authorization checks in `server.js`.

**Problem:** The original application used a publicly known fallback JWT signing secret. It then trusted the role inside a signed token without confirming that the account existed or still had that role.

**Impact:** Someone who knew the default signing secret could forge a token claiming TA privileges, read the section's grades and restricted instructor note, and access the grade-writing endpoint. A separate missing ownership check allowed signed-in students to request other students' grades.

**Live demo:** No hosted Marks URL has been supplied. The results below come from local tests.

## Steps to reproduce

Use the original, unpatched application with a disposable database and no custom `JWT_SECRET`. These commands target only the local demonstration server.

1. Install its dependencies and start the original application with `npm start`.
2. Open a second PowerShell window in that original project folder.
3. Generate a token using the original development key. The subject `999` deliberately names an account that does not exist in the demo store:

```powershell
$forgedToken = node -e "console.log(require('jsonwebtoken').sign({sub:999,role:'ta'},'marks-dev-secret'))"
```

4. Send it to the TA-only section endpoint:

```powershell
Invoke-RestMethod -Uri 'http://localhost:3000/api/section' -Headers @{ Authorization = "Bearer $forgedToken" }
```

**Expected behavior:** The server rejects the request because it is not authenticated as a real TA.

**Observed behavior before the patch:** The local test received HTTP 200 and section data using a forged token for a nonexistent account. The original server verified the signature against the known key and trusted the supplied `role`.

**Cause:** JWT signatures protect claims only when the signing key remains private. A hardcoded fallback allows anyone with the source to create tokens the application accepts. Trusting token roles without resolving the current account adds a second authorization weakness.

## Code examples

### Vulnerable code: before the patch

In `lib/tokens.js`:

```javascript
const SECRET = process.env.JWT_SECRET || "marks-dev-secret";
```

The original verification accepted tokens signed with that key:

```javascript
return jwt.verify(token, SECRET);
```

In `server.js`, the middleware stored the token claims directly:

```javascript
function requireUser(req, res, next) {
  const claims = readToken(req.headers.authorization);
  if (!claims) return res.status(401).json({ error: "Sign in again." });
  req.claims = claims;
  next();
}
```

The TA routes then checked `req.claims.role`, which an attacker could choose when creating a token with the development key.

### Patched code: after the fix

In `lib/tokens.js`:

```javascript
const SECRET = process.env.JWT_SECRET;
if (!SECRET || Buffer.byteLength(SECRET, "utf8") < 32) {
  throw new Error("Set JWT_SECRET to a unique random secret of at least 32 bytes.");
}
```

Verification now restricts the algorithm and validates the account identifier:

```javascript
const claims = jwt.verify(token, SECRET, { algorithms: ["HS256"] });
if (!claims || typeof claims !== "object" ||
    !Number.isSafeInteger(claims.sub) || claims.sub <= 0) return null;
return claims;
```

The authentication middleware resolves a real account:

```javascript
function requireUser(req, res, next) {
  const claims = readToken(req.headers.authorization);
  if (!claims) return res.status(401).json({ error: "Sign in again." });
  const user = load().users.find((row) => row.id === claims.sub);
  if (!user) return res.status(401).json({ error: "Unknown account." });
  req.user = user;
  next();
}
```

TA-only routes now check the account's stored role:

```javascript
if (req.user.role !== "ta") {
  return res.status(403).json({ error: "Section view is for the TA." });
}
```

**Fix:** Require a private signing key, validate the token and account, and use the current database role for authorization. The signing function also explicitly uses HS256. Generate the key randomly; a length check alone does not make a predictable value secure.

**Observed behavior after the patch:** Tokens signed with the old development key return HTTP 401. Tokens for nonexistent accounts are rejected. A token signed with the configured key but falsely claiming a student is a TA receives HTTP 403 from TA-only operations.

## Additional fixes

| Location | Original problem | Change |
|---|---|---|
| `server.js`, `/api/students/:id` | Any signed-in student could retrieve another student's grades. | Require the requested ID to match the current user, unless the current user is a TA. Validate the ID before lookup. |
| `lib/store.js` | A fixed TA password was embedded in the seed data. | Require a private `INITIAL_TA_PASSWORD` for new databases; provide an explicit reset script for existing ones. |
| `public/app.js` | Grade titles and other values were inserted into HTML without encoding. | Escape dynamic text before HTML insertion, including data already stored in the JSON file. |

The student-record endpoint now includes:

```javascript
if (req.user.role !== "ta" && req.user.id !== Number(req.params.id)) {
  return res.status(403).json({ error: "You can only view your own marks." });
}
```

### Existing databases

Stop the server and back up the JSON store. Rotate `JWT_SECRET` and reset the old TA password using the same `DATABASE_PATH` as the application:

```powershell
$env:NEW_TA_PASSWORD = node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
$env:NEW_TA_PASSWORD
node scripts/reset-ta-password.js priya
```

Save the displayed password privately. The script preserves grades and other accounts. Keep the supplied `scripts/` folder until this step is complete. Source changes alone do not revoke the old stored password.

## Security and normal functionality checks

The supplied `test/security.test.js` contains 11 automated tests. After installing dependencies, run `npm test` from the patched project folder. Keep the `test/` folder to run these checks.

| Test | Actual result |
|---|---|
| Student login and own marks | Valid sign-in and own-record reads succeeded; an incorrect password was rejected. |
| Student access to others' grades and TA operations | Requests returned 403; unauthorized grade writes did not alter the store. |
| TA access and grading | Section access and student lookup succeeded; a new zero-score mark was saved. |
| Missing, forged, expired, malformed, and unsupported tokens | Requests returned 401, including tokens for nonexistent accounts. |
| Token role differs from stored role | The stored role prevailed; the student could not perform TA actions. |
| Invalid student IDs | Requests returned 400. |
| Old hardcoded TA password | Login was rejected on the fresh patched database. |
| Missing or short signing secret | Startup was rejected with a configuration error. |
| Missing, short, or old initial TA password | Fresh database creation was rejected. |
| Existing-store loading and password reset | Loading preserved data; resetting the TA password preserved grades and student accounts. |
| Grade markup and other displayed values | Rendering functions escaped markup as text; ordinary grade text and zero scores remained intact. |

**Verification status:** All 11 tests passed against the patched code. Tests used disposable local stores. HTML checks examined generated output using Node's VM; they were not browser automation tests. No screenshots were captured, and no hosted deployment or full dependency advisory audit was performed.

## Summary

The patch removes public server credentials, checks current account permissions, restricts student-record access, and encodes displayed text. Normal student sign-in and TA grading continue to work in local tests. Existing deployments must rotate the signing secret and reset the previously seeded TA password to complete the upgrade.
