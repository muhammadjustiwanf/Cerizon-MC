import express from "express";
import bodyParser from "body-parser";
import fs from "fs-extra";
import { Rcon } from "rcon-client";

const app = express();
const DB_PATH = "./database.json";

app.use(bodyParser.json());
app.use(express.static("public"));

// === Fungsi Helper ===
async function loadDB() {
  try {
    return JSON.parse(await fs.readFile(DB_PATH, "utf8"));
  } catch {
    return { users: [] };
  }
}

async function saveDB(data) {
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));
}

// === REGISTER ===
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "Data tidak lengkap." });

  const db = await loadDB();
  if (db.users.find(u => u.username === username))
    return res.status(400).json({ error: "Username sudah terdaftar." });

  db.users.push({ username, password, claimed: false });
  await saveDB(db);
  console.log(`[REGISTER] ${username} terdaftar.`);
  res.json({ success: true });
});

// === LOGIN ===
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  const db = await loadDB();
  const user = db.users.find(u => u.username === username && u.password === password);

  if (!user)
    return res.status(401).json({ error: "Username atau password salah." });

  res.json({ success: true, user });
});

// === STATUS USER ===
app.post("/api/status", async (req, res) => {
  const { username } = req.body;
  const db = await loadDB();
  const user = db.users.find(u => u.username === username);
  if (!user) return res.status(404).json({ error: "User tidak ditemukan." });
  res.json({ claimed: user.claimed });
});

// === KLAIM HADIAH ===
app.post("/api/claim", async (req, res) => {
  const { username } = req.body;
  const db = await loadDB();
  const user = db.users.find(u => u.username === username);

  if (!user) return res.status(404).json({ error: "User tidak ditemukan." });
  if (user.claimed) return res.status(400).json({ error: "Hadiah sudah diklaim." });

  try {
    const rcon = await Rcon.connect({
      host: "localhost",   // ganti IP server Minecraft kamu
      port: 25575,         // sesuaikan port RCON
      password: "yourRCONpassword"
    });

    await rcon.send(`give ${username} diamond 5`);
    await rcon.end();

    user.claimed = true;
    await saveDB(db);

    console.log(`[CLAIM] ${username} menerima hadiah.`);
    res.json({ success: true });
  } catch (err) {
    console.error("RCON Error:", err);
    res.status(500).json({ error: "Gagal mengirim hadiah ke server Minecraft." });
  }
});

app.listen(3000, () => console.log("✅ Cerizon server aktif di http://localhost:3000"));
