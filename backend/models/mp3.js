const mongoose = require('mongoose');

const mp3Schema = new mongoose.Schema({
  filename: String,
  data: Buffer,
  contentType: String,
  uploadDate: {
    type: Date,
    default: Date.now
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
});

module.exports = mongoose.model('MP3', mp3Schema);