const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const routes = require('./routes/routes');
require("dotenv").config();

const app = express();

//ORDINEA CONTEAZa prostule
app.use(cors({
  origin: "http://localhost:4200",
  credentials: true,
}));


app.use(cookieParser());
app.use(express.json());
app.use('/api', routes);
const path = require('path');
// Servește fișierele din directorul "uploads"
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log("✅ Conectat cu succes la baza de date");
  app.listen(5000, () => {
    console.log("🚀 Serverul rulează pe portul 5000");
  });
})
.catch(err => {
  console.error("❌ Eroare critică la conectarea la MongoDB:", err);
  process.exit(1); // Ieșire din proces cu eroare
});

// Ruta principală
app.get("/", (req, res) => {
  res.send("Serverul funcționează!");
});