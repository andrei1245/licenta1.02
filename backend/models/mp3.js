const mongoose = require('mongoose');

const mp3Schema = new mongoose.Schema({
  filename: {
    type: String,
    required: true
  },
  data: {
    type: Buffer,
    required: true
  },
  contentType: {
    type: String,
    required: true,
    enum: ['audio/mpeg', 'audio/webm', 'audio/webm;codecs=opus']
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  uploadDate: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('MP3', mp3Schema);