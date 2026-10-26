const path = require("path");
const express = require("express");
const bcrypt = require("bcryptjs");
const { load, save } = require("./lib/store");
const { signToken, readToken } = require("./lib/tokens");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    role: user.role
  };
}

function requireUser(req, res, next) {
  const claims = readToken(req.headers.authorization);
  if (!claims) return res.status(401).json({ error: "Sign in again." });
  const user = load().users.find((row) => row.id === claims.sub);
  if (!user) return res.status(401).json({ error: "Unknown account." });
  req.user = user;
  next();
}

app.get("/api/health", (_req, res) => {
  load();
  res.json({ ok: true });
});

app.post("/api/login", (req, res) => {
  const username = String(req.body.username || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const db = load();
  const user = db.users.find((row) => row.username === username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Those credentials do not match a Marks account." });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

app.get("/api/me", requireUser, (req, res) => {
  const db = load();
  const user = req.user;
  const grades = db.grades.filter((row) => row.student_id === user.id);
  res.json({ user: publicUser(user), course: db.section.course, grades });
});

app.get("/api/students/:id", requireUser, (req, res) => {
  if (!/^[1-9]\d*$/.test(req.params.id) || !Number.isSafeInteger(Number(req.params.id))) {
    return res.status(400).json({ error: "Invalid student id." });
  }
  if (req.user.role !== "ta" && req.user.id !== Number(req.params.id)) {
    return res.status(403).json({ error: "You can only view your own marks." });
  }
  const db = load();
  const student = db.users.find((row) => row.id === Number(req.params.id) && row.role === "student");
  if (!student) return res.status(404).json({ error: "No student with that id." });
  const grades = db.grades.filter((row) => row.student_id === student.id);
  res.json({ user: publicUser(student), grades });
});

app.get("/api/section", requireUser, (req, res) => {
  if (req.user.role !== "ta") {
    return res.status(403).json({ error: "Section view is for the TA." });
  }
  const db = load();
  const students = db.users
    .filter((row) => row.role === "student")
    .map((student) => ({
      user: publicUser(student),
      grades: db.grades.filter((row) => row.student_id === student.id)
    }));
  res.json({
    course: db.section.course,
    term: db.section.term,
    instructor_note: db.section.instructor_note,
    students
  });
});

app.post("/api/grades", requireUser, (req, res) => {
  if (req.user.role !== "ta") {
    return res.status(403).json({ error: "Only the TA can enter marks." });
  }
  const studentId = Number(req.body.student_id);
  const item = String(req.body.item || "").trim();
  const score = Number(req.body.score);
  const outOf = Number(req.body.out_of);
  if (!studentId || !item || Number.isNaN(score) || Number.isNaN(outOf)) {
    return res.status(400).json({ error: "student_id, item, score, and out_of are required." });
  }
  const db = load();
  db.grades.push({ student_id: studentId, item, score, out_of: outOf });
  save(db);
  res.status(201).json({ ok: true });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const port = Number(process.env.PORT || 3000);
load();
const server = app.listen(port, "0.0.0.0", () => {
  console.log(`Marks listening on ${server.address().port}`);
});
