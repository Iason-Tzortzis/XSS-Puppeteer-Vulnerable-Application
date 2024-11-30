//Dependencies
const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const cookieParser = require("cookie-parser");
const fs = require("fs");
const ejsMate = require("ejs-mate");
var jwt = require("jsonwebtoken");
const Str_Random = require("./generate_random_string.js");
const puppeteer = require("puppeteer");
require("dotenv").config({
  path: "/.env",
});
require("dotenv/config");

//App Setup
app.use(cookieParser());
app.use(express.urlencoded());
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "/views"));
app.engine("ejs", ejsMate);
app.use(express.static(path.join(__dirname, "static")));
app.use(bodyParser.urlencoded({ extended: true }));

const port = process.env.PORT || 8000;
const SECRET_KEY = String(Str_Random(32));

//Load flag
const flag = (function (flag_path) {
  if (fs.existsSync(flag_path)) {
    return fs.readFileSync(path.join(__dirname, "flag"), "utf8").trim();
  } else {
    return "FLAG{example-flag-for-testing}";
  }
})(path.join(__dirname, "flag"));

// Declare database
const db = new sqlite3.Database(
  path.join(__dirname, "thesis-challenges-4.db"),
  function (error) {
    if (error) {
      return console.error(error.message);
    } else {
      console.log("Connection with Database has been established.");
    }
  }
);

var complaintUsername = "";

//Create tables for users and complaints
function createUsersTable() {
  db.exec(`
        DROP TABLE IF EXISTS users;
        CREATE TABLE users
        (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            firstName TEXT,
            lastName TEXT,
            username TEXT,
            password TEXT,
            role TEXT
        );

        DROP TABLE IF EXISTS complaints;
        CREATE TABLE complaints
    (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        email TEXT,
        complaint TEXT
    );
  `);
}

//Insert a user account
function insertRow(firstName, lastName, username, password, role) {
  db.run(
    "INSERT INTO users (firstName, lastName, username, password, role) VALUES (?, ?, ?, ?, ?)",
    [firstName, lastName, username, password, role]
  );
  console.log("Data Inserted Successfully.");
}

//Insert a complaint
function insertComplaint(username, email, complaint) {
  db.run(
    "INSERT INTO complaints (username, email, complaint) VALUES (?, ?, ?)",
    [username, email, complaint]
  );
  console.log("Data Inserted Successfully.");
}

//Delete complaints associated with the provided username
function deleteComplaint(username) {
  db.run("DELETE FROM complaints WHERE username= ?", [username]);
  console.log("Data Deleted Successfully.");
}

//Setup database
function setupdb() {
  createUsersTable();
  insertRow("test", "test", "test", "test", "user");
}

//Start database
setupdb();

//Headless browser flow
async function launchPuppeteer() {
  try {
    const browser = await puppeteer.launch({
      executablePath: "/usr/bin/google-chrome",
      headless: true,
      args: [
        "--incognito",
        "--no-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--disable-setuid-sandbox",
      ],
    });
    const page = await browser.newPage();
    await page.goto("http://xss-puppeteer-app-1:8000/login");
    console.log("Went to login");
    await page.type("#username", process.env.BOT_USERNAME);
    await page.type("#password", process.env.BOT_PASSWORD);
    await page.click("button.btn-primary");
    console.log("Waiting for navigation");
    await page.waitForNavigation();
    await page.goto("http://xss-puppeteer-app-1:8000/messages");
    console.log("Went to messages");
    await new Promise((r) => setTimeout(r, 5000));
    await page.goto("http://xss-puppeteer-app-1:8000/logout");
    console.log("Logged out");
    deleteComplaint(complaintUsername);
    await browser.close();
  } catch (e) {
    console.log(e);
  }
}

//Routes
app.get("/login", async function (req, res) {
  try {
    return res.render("login");
  } catch (e) {
    return res.send("Error while loading the page");
  }
});

app.post("/login", async function (req, res, next) {
  try {
    //Get supplied credentials from the request body
    let username = req.body.username;
    let password = req.body.password;

    //check if login request is being performed for the headless browser or an actual user
    if (!(username == process.env.BOT_USERNAME)) {
      sql = `SELECT * FROM users WHERE username= ? AND password= ?`;
      const result = await new Promise(async function (res, rej) {
        db.get(sql, [username, password], function (e, r) {
          if (e) {
            rej(e.message);
          } else {
            res(r);
          }
        });
      }).catch(function (e) {
        return res.redirect("/forbidden");
      });

      //if user record found generate JWT token
      if (result) {
        let token_data = {
          username: result.username,
          role: result.role,
        };
        token = jwt.sign(token_data, SECRET_KEY, { expiresIn: "1h" });
        res.cookie("JWT", token);
        return res.redirect("/home");
      } else {
        return res.send("Invalid credentials submitted");
      }
      //if login process is being performed for the headless browser generate JWT token with admin priveleges
    } else {
      if (password == process.env.BOT_PASSWORD) {
        let token_data = {
          username: username,
          role: "admin",
        };
        token = jwt.sign(token_data, SECRET_KEY, { expiresIn: "1h" });
        res.cookie("JWT", token);
        return res.redirect("/home");
      }
    }
  } catch (e) {
    res.send("Error while performing the login process");
  }
});

app.get("/complaints", async function (req, res) {
  try {
    try {
      //Get token from request object
      token = req.cookies.JWT;

      //If no token found redirect to login page
      if (!token) {
        return res.redirect("/");
      }

      //Verify tokens signature
      var data = jwt.verify(token, SECRET_KEY);
    } catch (err) {
      return res.send("Missing valid JWT token");
    }

    //if token is valid render complaints page
    if (data) {
      return res.render("complaints", {
        message: "",
        is_successfull: false,
      });
    } else {
      return res.send("Missing valid JWT token");
    }
  } catch (e) {
    return res.send("Error while loading the page");
  }
});

app.post("/complaints", async function (req, res, next) {
  try {
    try {
      //Get token from request object
      token = req.cookies.JWT;

      //If no token found redirect to login page
      if (!token) {
        return res.redirect("/");
      }

      //Verify tokens signature
      var data = jwt.verify(token, SECRET_KEY);
    } catch (err) {
      return res.send("Missing valid JWT token");
    }

    //if token is valid perform the post request
    if (data) {
      let email = req.body.email;
      let complaint = req.body.complaint;
      complaintUsername = data.username;
      insertComplaint(data.username, email, complaint);
      launchPuppeteer();
      success = true;
      return res.render("complaints", {
        message: "Youre complaint was succesfully submitted",
        is_successfull: success,
      });
    } else {
      return res.send("Missing valid JWT token");
    }
  } catch (e) {
    return res.render("complaints", {
      message: "Error while submitting your complaint",
      is_successfull: false,
    });
  }
});

app.get("/home", function (req, res) {
  try {
    try {
      //Get token from request object
      token = req.cookies.JWT;

      //If no token found redirect to login page
      if (!token) {
        return res.redirect("/");
      }

      //Verify tokens signature
      var data = jwt.verify(token, SECRET_KEY);
    } catch (err) {
      return res.send("Missing valid JWT token");
    }

    //if token is valid render home page
    if (data) {
      return res.render("home", { username: data.username });
    } else {
      return res.send("Missing valid JWT token");
    }
  } catch (err) {
    return res.send("Missing valid JWT token");
  }
});

app.get("/messages", async function (req, res) {
  try {
    try {
      //Get token from request object
      token = req.cookies.JWT;

      //If no token found redirect to login page
      if (!token) {
        return res.redirect("/");
      }

      //Verify tokens signature
      var data = jwt.verify(token, SECRET_KEY);
    } catch (err) {
      return res.send("Missing valid JWT token");
    }

    //if token is valid continue flow
    if (data) {
      //check if authenticated user has admin priveleges before rendering the page
      if (data.role == "admin") {
        console.log("hello from messages");
        //Get all messages
        sql = `SELECT * FROM complaints`;
        const result = await new Promise(async function (res, rej) {
          db.all(sql, function (e, r) {
            if (e) {
              rej(e.message);
            } else {
              res(r);
            }
          });
        }).catch(function (e) {
          return res.send("Error while fetching the messages");
        });

        //if messages found render the page
        if (result) {
          return res.render("messages", { data: result, flag: flag });
        } else {
          return res.send("Error while getting the messages");
        }
      } else {
        return res.redirect("/forbidden");
      }
    } else {
      return res.redirect("/forbidden");
    }
  } catch (err) {
    return res.send("Error 404");
  }
});

app.get("/forbidden", function (req, res) {
  return res.render("forbidden");
});

app.get("/logout", function (req, res) {
  res.clearCookie("JWT");
  return res.redirect("/");
});

app.get("*", function (req, res) {
  return res.redirect("/login");
});

//Start App
app.listen(port, function () {
  console.log(`Serving on Port ${port}`);
});
