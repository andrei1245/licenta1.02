const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const routes = require('./routes/routes');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
require("dotenv").config();

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const app = express();

//ORDINEA CONTEAZa prostule
app.use(cors({
  origin: "http://localhost:4200",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  exposedHeaders: ['Access-Control-Allow-Origin', 'Access-Control-Allow-Credentials']
}));

// Add pre-flight handling
app.options('*', cors());

// Asigură-te că aceste middleware-uri sunt în această ordine
app.use(cookieParser());
app.use(express.json());
app.use('/api', routes);
const path = require('path');


// Add error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

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
  process.exit(1); 
});

// Test FFmpeg installation
ffmpeg.getAvailableFormats((err, formats) => {
  if (err) {
    console.error('FFmpeg error:', err);
  } else {
    console.log('FFmpeg is working correctly');
  }
});

app.get("/", (req, res) => {
  res.send("Serverul funcționează!");
});