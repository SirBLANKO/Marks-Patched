const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET;
if (!SECRET || Buffer.byteLength(SECRET, "utf8") < 32) {
  throw new Error("Set JWT_SECRET to a unique random secret of at least 32 bytes.");
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      role: user.role
    },
    SECRET,
    { expiresIn: "7d", algorithm: "HS256" }
  );
}

function readToken(header) {
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice(7);
  try {
    const claims = jwt.verify(token, SECRET, { algorithms: ["HS256"] });
    if (!claims || typeof claims !== "object" ||
        !Number.isSafeInteger(claims.sub) || claims.sub <= 0) return null;
    return claims;
  } catch {
    return null;
  }
}

module.exports = { SECRET, signToken, readToken };
