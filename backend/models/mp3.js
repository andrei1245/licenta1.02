const mongoose = require('mongoose');

const mp3Schema = new mongoose.Schema({
  filename: String,
  data: Buffer,
  contentType: String,
  uploadDate: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('MP3', mp3Schema);