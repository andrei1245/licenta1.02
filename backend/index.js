const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const routes = require('./routes/routes');
require("dotenv").config();

const app = express();

// Middleware setup (ORDINEA CONTEAZĂ)
app.use(cors({
  credentials: true,
  origin: 'http://localhost:4200',
  methods: "GET,POST,PUT,DELETE,OPTIONS",
  allowedHeaders: "Content-Type,Authorization"
}));
app.use(cookieParser());
app.use(express.json());

// Rute
app.use('/api', routes);

console.log("Loaded routes.js!");
console.log("Registered routes:");
app._router.stack.forEach((middleware) => {
  if (middleware.route) {
    console.log(middleware.route.path);
  } else if (middleware.name === 'router') {
    middleware.handle.stack.forEach((nested) => {
      if (nested.route) {
        console.log(nested.route.path);
      }
    });
  }
});

// Conectare la baza de date
mongoose.connect(process.env.MONGO_URL)
  .then(() => {
    console.log("Conectat la baza de date");
    app.listen(5000, () => {
      console.log("Aplicația rulează pe portul 5000");
    });
  })
  .catch(err => {
    console.error("Eroare la conectarea la baza de date:", err);
  });

// Ruta principală
app.get("/", (req, res) => {
  res.send("Serverul funcționează!");
});