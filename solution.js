import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = 5500;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "school",
  password: "9347897640",
  port: 5432,
});
db.connect();

const db1 = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "world",
  password: "9347897640",
  port: 5432,
});
db1.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let currentUserId = 1;

let users = [
  { id: 1, name: "Angela", color: "teal" },
  { id: 2, name: "Jack", color: "powderblue" },
];

async function checkVisisted() {
  const result = await db.query(
    "SELECT country_code FROM visited_countries JOIN users ON users.id = user_id WHERE user_id = $1; ",
    [currentUserId]
  );
  let countries = [];
 console.log(result.rows)
  result.rows.forEach((country) => {
    countries.push(country.country_code);
  });
  return countries;
}

async function getCurrentUser() {
  const result = await db.query("SELECT * FROM users");
  users = result.rows;
  console.log(users)
  return users.find((user) => user.id == currentUserId);
}

app.get("/", async (req, res) => {
  const countries = await checkVisisted();
  console.log(countries)
  const currentUser = await getCurrentUser();
  res.render("index.ejs", {
    countries: countries,
    total: countries.length,
    users: users,
    color: currentUser.color,
  });
});


app.post("/add", async (req, res) => {
  const input = req.body["country"].trim().toLowerCase();
  const currentUser = await getCurrentUser();

  let countryCode;

  try {
    const exactMatch = await db1.query(
      "SELECT country_code FROM countries WHERE LOWER(country_name) = $1;",
      [input]
    );

    if (exactMatch.rows.length > 0) {
      countryCode = exactMatch.rows[0].country_code;
    } else {
      const partialMatch = await db1.query(
        "SELECT country_code FROM countries WHERE LOWER(country_name) LIKE '%' || $1 || '%';",
        [input]
      );

      if (partialMatch.rows.length > 0) {
        countryCode = partialMatch.rows[0].country_code;
      } else {
        console.log("No matching country found.");
        return res.redirect("/"); // ⛔ Exit before insert
      }
    }

    // ✅ Safe to insert now
    await db.query(
      "INSERT INTO visited_countries (country_code, user_id) VALUES ($1, $2)",
      [countryCode, currentUserId]
    );
    res.redirect("/");

  } catch (err) {
    console.log("Error inserting country:", err);
    res.redirect("/");
  }
});

app.post("/user", async (req, res) => {
  if (req.body.add === "new") {
    res.render("new.ejs");
  } else {
    currentUserId = req.body.user;
    res.redirect("/");
  }
});

app.post("/new", async (req, res) => {
  const name = req.body.name;
  const color = req.body.color;


  const result = await db.query(
    "INSERT INTO users (name, color) VALUES($1, $2) RETURNING *;",
    [name, color]
  );

  const id = result.rows[0].id;
  currentUserId = id;

  res.redirect("/");
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
