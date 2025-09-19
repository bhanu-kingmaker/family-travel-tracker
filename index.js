import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 5500;

const sslConfig = process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false;

const db = new pg.Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
  ssl: sslConfig,
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

let currentUserId = 1;
let users = [];

async function checkVisited() {
  const result = await db.query(
    "SELECT country_code FROM visited_countries WHERE user_id = $1;",
    [currentUserId]
  );
  return result.rows.map((row) => row.country_code);
}

async function getCurrentUser() {
  const result = await db.query("SELECT * FROM users;");
  users = result.rows;
  return users.find((user) => user.id == currentUserId);
}

app.get("/", async (req, res) => {
  try {
    const countries = await checkVisited();
    const currentUser = await getCurrentUser();
    res.render("index.ejs", {
      countries,
      total: countries.length,
      users,
      color: currentUser?.color || "#ccc",
    });
  } catch (err) {
    console.error("Error loading homepage:", err);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/add", async (req, res) => {
  const input = req.body["country"].trim().toLowerCase();
  let countryCode;

  try {
    // Try exact match
    const exactMatch = await db.query(
      "SELECT country_code FROM countries WHERE LOWER(country_name) = $1;",
      [input]
    );

    if (exactMatch.rows.length > 0) {
      countryCode = exactMatch.rows[0].country_code;
    } else {
      // Try partial match
      const partialMatch = await db.query(
        "SELECT country_code FROM countries WHERE LOWER(country_name) LIKE '%' || $1 || '%';",
        [input]
      );

      if (partialMatch.rows.length > 0) {
        countryCode = partialMatch.rows[0].country_code;
      } else {
        // Try alias match
        const aliasMatch = await db.query(
          "SELECT country_code FROM country_aliases WHERE LOWER(alias) = $1;",
          [input]
        );

        if (aliasMatch.rows.length > 0) {
          countryCode = aliasMatch.rows[0].country_code;
        } else {
          console.log("No matching country found for input:", input);
          return res.redirect("/");
        }
      }
    }

    console.log("Matched country code:", countryCode);

    await db.query(
      "INSERT INTO visited_countries (country_code, user_id) VALUES ($1, $2);",
      [countryCode, currentUserId]
    );

    res.redirect("/");
  } catch (err) {
    console.error("Error inserting country:", err);
    res.redirect("/");
  }
});

app.post("/user", async (req, res) => {
  if (req.body.add === "new") {
    res.render("new.ejs");
  } else {
    currentUserId = parseInt(req.body.user);
    res.redirect("/");
  }
});

app.post("/new", async (req, res) => {
  const { name, color } = req.body;
  try {
    const result = await db.query(
      "INSERT INTO users (name, color) VALUES ($1, $2) RETURNING *;",
      [name, color]
    );
    currentUserId = result.rows[0].id;
    res.redirect("/");
  } catch (err) {
    console.error("Error creating new user:", err);
    res.redirect("/");
  }
});

app.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
});
