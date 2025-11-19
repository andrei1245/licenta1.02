const { Router } = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const multer = require('multer');
const router = Router();
const MP3 = require('../models/mp3');
const mongoose = require('mongoose');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const fs = require('fs');
const path = require('path');
const say = require('say');
const gtts = require('google-tts-api');
const https = require('https');
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

require("dotenv").config();
const SECRET_KEY1 = process.env.SECRET_KEY; 

const storage = multer.memoryStorage(); 

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Accept both MP3 and WebM audio files
    if (file.mimetype === 'audio/mpeg' || 
        file.mimetype === 'audio/webm' || 
        file.mimetype === 'audio/webm;codecs=opus') {
      cb(null, true);
    } else {
      cb(new Error('Only MP3 and WebM audio files are allowed!'));
    }
  }
});

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies.jwt;
    if (!token) return res.status(401).send('Neautorizat');

    const decoded = jwt.verify(token, SECRET_KEY1);
    req.user = await User.findById(decoded._id);
    next();
  } catch (err) {
    res.status(401).send('Neautorizat');
  }
};



router.post('/upload', authMiddleware, upload.single('mp3'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send({ message: 'No file uploaded' });
    }

    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const inputPath = path.join(tempDir, `${Date.now()}_input.webm`);
    const outputPath = path.join(tempDir, `${Date.now()}_output.mp3`);

    try {
      fs.writeFileSync(inputPath, req.file.buffer);

      // Convert WebM to MP3 with minimal processing
      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .toFormat('mp3')
          // For trimming initial silence, use the atrim filter; adjust start time if needed.
          .outputOptions([
            '-af', 'atrim=start=1.1',  // Remove the first 0.1 second
            '-acodec', 'libmp3lame',
            '-ab', '128k',
            '-ar', '44100',
            '-ac', '2'
          ])
          .on('start', (commandLine) => {
            console.log('FFmpeg command:', commandLine);
          })
          .on('error', reject)
          .on('end', resolve)
          .save(outputPath);
      });

      const finalBuffer = fs.readFileSync(outputPath);

      const mp3 = new MP3({
        filename: req.file.originalname.replace('.webm', '.mp3'),
        data: finalBuffer,
        contentType: 'audio/mpeg',
        user: req.user._id
      });

      await mp3.save();

      // Cleanup
      fs.unlinkSync(inputPath);
      fs.unlinkSync(outputPath);

      res.status(200).send({
        message: 'File uploaded successfully',
        file: mp3._id
      });
    } catch (error) {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      throw error;
    }
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).send({ message: 'Error uploading file: ' + error.message });
  }
});


router.post('/mp3/:id/copy', authMiddleware, async (req, res) => {
  try {
    const mp3 = await MP3.findById(req.params.id);
    if (!mp3) {
      return res.status(404).json({ message: 'File not found' });
    }
    if (mp3.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const newMp3 = new MP3({
      filename: mp3.filename + "(copy).mp3",
      data: mp3.data,
      contentType: mp3.contentType,
      user: req.user._id
    });

    await newMp3.save();
    res.status(200).json({ 
      message: 'File copied successfully', 
      fileId: newMp3._id 
    });
  } catch (error) {
    console.error('Copy error:', error);
    res.status(500).json({ message: 'Error copying file' });
  }
});

router.delete('/delete-mp3/:id', (req, res) => {
  const fileId = req.params.id;
  console.log('[DEBUG] Deleting file ID:', fileId);

  MP3.findByIdAndDelete(fileId)
    .then(file => {
      if (!file) {
        console.log('[DEBUG] File not found');
        return res.status(404).json({ message: 'File not found' });
      }
      console.log('[DEBUG] Deleted file:', file);
      res.status(200).json({ message: 'File deleted successfully' });
    })
    .catch(err => {
      console.error('[ERROR] Delete error:', err);
      res.status(500).json({ message: 'Server error' });
    });
});


router.get('/mp3/:id', authMiddleware, async (req, res) => {
  try {
    const mp3 = await MP3.findById(req.params.id);
    if (!mp3) {
      return res.status(404).send({ message: 'File not found' });
    }

    // Set proper headers for audio streaming
    res.set({
      'Content-Type': 'audio/mpeg',
      'Accept-Ranges': 'bytes',
      'Content-Length': mp3.data.length,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': 'http://localhost:4200',
      'Access-Control-Allow-Credentials': 'true'
    });

    // Send the file data directly
    res.send(mp3.data);
  } catch (error) {
    console.error('Error streaming audio:', error);
    res.status(500).send({ message: 'Error retrieving file' });
  }
});

router.get('/mp3/:id/details', authMiddleware, async (req, res) => {
  try {
    const mp3 = await MP3.findById(req.params.id)
      .select('_id filename uploadDate user')
      .lean();

    if (!mp3) {
      return res.status(404).json({ 
        success: false,
        error: "Fișier negăsit" 
      });
    }

    
    if (mp3.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: "Acces interzis"
      });
    }

    res.status(200).json({
      success: true,
      data: {
        _id: mp3._id,
        filename: mp3.filename,
        uploadDate: mp3.uploadDate
      }
    });

  } catch (error) {
    console.error('Eroare detalii fișier:', error);
    res.status(500).json({
      success: false,
      error: "Eroare server",
      details: error.message
    });
  }
});

router.get('/mp3s', authMiddleware, async (req, res) => {
  try {
    const files = await MP3.find({ user: req.user._id })
                         .select('filename _id uploadDate')
                         .lean();
    
    // Return data in consistent format
    res.status(200).json({
      success: true,
      data: files
    });
  } catch (error) {
    console.error('Error fetching MP3s:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving files list',
      error: error.message
    });
  }
});

router.put('/edit-mp3/:id', authMiddleware, async (req, res) => {
  try {
    const mp3 = await MP3.findById(req.params.id);
    
    if (!mp3) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    if (mp3.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    mp3.filename = req.body.filename;
    await mp3.save();

    res.json({ success: true, message: 'File updated successfully' });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ success: false, message: 'Update failed' });
  }
});

router.post('/register', async (req, res) => {
  try {
    const email = req.body.email;
    const password = req.body.password;

    const salt = await bcrypt.genSalt(10);
    const hashed_password = await bcrypt.hash(password, salt);

    const record = await User.findOne({ email: email });
    if (record) {
      return res.status(400).json({
        message: "This email is already registered"
      });
    } else {
      // Creează un nou user
      const user = new User({
        email: email,
        password: hashed_password 
      });
      const result = await user.save();

      // Extrage _id-ul din user-ul salvat
      const { _id } = result.toJSON();

      // Folosește SECRET_KEY
      const token = jwt.sign({ _id: _id }, SECRET_KEY1);

      // Setează cookie-ul cu token-ul JWT
      res.cookie("jwt", token, {
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000  // 1 zi
      });

      // Trimite răspunsul de succes
      res.status(200).json({
        message: 'Registration is successful'
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'An error occurred during registration' });
  }
});

router.post('/login', async (req, res) => {
  const user= await User.findOne({email:req.body.email})
  if(!user){
    return res.status(404).send({
      message:"User not found"
    })
  }
  if(!(await bcrypt.compare(req.body.password,user.password))){
    return res.status(400).send({
      message:"Password is incorrect"
    })
  }
  const token= jwt.sign({_id:user._id},SECRET_KEY1)
  res.cookie("jwt",token,{
    httpOnly:true,
    maxAge:24*60*60*1000
  })
  res.send({
    message:"succes"
  })
});

router.get('/user', async (req, res) => {
  try {
    console.log("Cookies received:", req.cookies); 

    const cookie = req.cookies.jwt;

    if (!cookie) {
      return res.status(401).send({ message: "unauthenticated - no cookie" });
    }

    const claims = jwt.verify(cookie, SECRET_KEY1); 

    if (!claims) {
      return res.status(401).send({ message: "unauthenticated - invalid JWT" });
    }

    const user = await User.findOne({ _id: claims._id });

    if (!user) {
      return res.status(401).send({ message: "unauthenticated - user not found" });
    }

    const { password, ...data } = user.toJSON(); 
    res.send(data);

  } catch (err) {
    console.error("JWT verification error:", err);
    return res.status(401).send({ message: "unauthenticated - error in processing" });
  }
});

router.put('/user/update', authMiddleware, async (req, res) => {
  try {
    const { email, old_password, new_password } = req.body;
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify old password for any changes
    if (!old_password) {
      return res.status(400).json({ message: 'Current password is required' });
    }

    const isMatch = await bcrypt.compare(old_password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Update email if provided
    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return res.status(400).json({ message: 'Email is already in use' });
      }
      user.email = email;
    }

    // Update password if new password is provided
    if (new_password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(new_password, salt);
    }

    await user.save();
    res.status(200).json({ message: 'Account updated successfully' });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/logout', async (req, res) => {
  console.log("Received POST request to /logout"); 
  res.cookie("jwt", "", { maxAge: 0 });
  res.send({
    message: "Successfully logged out"
  });
});

// In your /mp3/:id/cut endpoint
router.post('/mp3/:id/cut', authMiddleware, async (req, res) => {
  try {
    const { startTime, endTime, baselineSoundLevel } = req.body;
    const volInput = (baselineSoundLevel !== undefined && baselineSoundLevel !== null)
      ? baselineSoundLevel
      : 100;
    const volumeFactor = volInput / 100;  // Converts 150% -> 1.5, 300% -> 3, etc.
    
    const mp3 = await MP3.findById(req.params.id);
    if (!mp3) {
      return res.status(404).json({ message: 'File not found' });
    }
    if (mp3.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Create temporary input file
    const tempDir = path.join(__dirname, '..', 'temp');
    const inputPath = path.join(tempDir, `${mp3._id}_input.mp3`);
    const outputPath = path.join(tempDir, `${mp3._id}_output.mp3`);
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    fs.writeFileSync(inputPath, mp3.data);
    console.log('Input file written:', inputPath);

    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(startTime)
        .setDuration(endTime - startTime)
        .outputOptions([
          '-acodec libmp3lame',
          '-b:a 128k',
          '-map 0:a',  // Only copy audio stream
          '-y',
          // Convert the percentage baseline into a multiplication factor.
          '-af', `volume=${volumeFactor}`
        ])
        .on('start', (commandLine) => {
          console.log('FFmpeg command:', commandLine);
        })
        .on('progress', (progress) => {
          console.log('Processing: ' + progress.percent + '% done');
        })
        .on('end', () => {
          console.log('FFmpeg processing finished');
          resolve();
        })
        .on('error', (err) => {
          console.error('FFmpeg error:', err);
          reject(err);
        })
        .save(outputPath);
    });

    // Read the processed file and update the MP3 document… (rest of your code)
    const processedData = fs.readFileSync(outputPath);
    console.log('Original file size:', mp3.data.length);
    console.log('Output file size:', processedData.length);

    const originalSize = mp3.data.length;
    mp3.data = processedData;
    await mp3.save();
    console.log('MP3 document updated in database');

    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);
    console.log('Temporary files cleaned up');

    res.status(200).json({ 
      message: 'MP3 cut successfully',
      originalSize: originalSize,
      newSize: processedData.length
    });

  } catch (error) {
    console.error('Cut error:', error);
    const tempDir = path.join(__dirname, '..', 'temp');
    const inputPath = path.join(tempDir, `${req.params.id}_input.mp3`);
    const outputPath = path.join(tempDir, `${req.params.id}_output.mp3`);
    
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

    res.status(500).json({ 
      message: 'Error processing audio',
      error: error.message
    });
  }
});

router.get('/mp3/:id/download', authMiddleware, async (req, res) => {
  try {
    const mp3 = await MP3.findById(req.params.id);
    
    if (!mp3) {
      return res.status(404).json({ message: 'File not found' });
    }

    if (mp3.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Set headers for file download
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Disposition': `attachment; filename="${mp3.filename}"`,
      'Content-Length': mp3.data.length
    });

    res.send(mp3.data);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ message: 'Error downloading file' });
  }
});

router.post('/mp3/:id/concat', authMiddleware, async (req, res) => {
  try {
    const { secondFileId } = req.body;
    const firstMp3 = await MP3.findById(req.params.id);
    const secondMp3 = await MP3.findById(secondFileId);

    if (!firstMp3 || !secondMp3) {
      return res.status(404).json({ message: 'One or both files not found' });
    }

    // Create temporary files
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const file1Path = path.join(tempDir, `${firstMp3._id}_1.mp3`);
    const file2Path = path.join(tempDir, `${secondMp3._id}_2.mp3`);
    const outputPath = path.join(tempDir, 'output.mp3');
    const listPath = path.join(tempDir, 'filelist.txt');

    // Write files
    fs.writeFileSync(file1Path, firstMp3.data);
    fs.writeFileSync(file2Path, secondMp3.data);

    // Create a file list for concat
    fs.writeFileSync(listPath, `file '${file1Path}'\nfile '${file2Path}'`);

    // Concatenate using FFmpeg with concat demuxer
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(listPath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions([
          '-acodec', 'copy'
        ])
        .on('start', (commandLine) => {
          console.log('FFmpeg command:', commandLine);
        })
        .on('error', (err) => {
          console.error('FFmpeg error:', err);
          reject(err);
        })
        .on('end', resolve)
        .save(outputPath);
    });

    // Read concatenated file
    const concatenatedData = fs.readFileSync(outputPath);

    // Update first file with concatenated data
    firstMp3.filename = firstMp3.filename.replace('.mp3', '') + '+'+secondMp3.filename.replace('.mp3', '') + '.mp3';
    firstMp3.data = concatenatedData;
    await firstMp3.save();

    // Cleanup
    fs.unlinkSync(file1Path);
    fs.unlinkSync(file2Path);
    fs.unlinkSync(outputPath);
    fs.unlinkSync(listPath);

    res.status(200).json({ message: 'Files concatenated successfully' });
  } catch (error) {
    console.error('Concat error:', error);
    // Cleanup on error
    const tempDir = path.join(__dirname, '..', 'temp');
    ['filelist.txt', 'output.mp3'].forEach(file => {
      const filePath = path.join(tempDir, file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
    res.status(500).json({ 
      message: 'Error concatenating files',
      error: error.message 
    });
  }
});

// Generate MP3 from text using TTS (Google TTS for Romanian, Windows TTS for English)
router.post('/convert-tts-to-mp3', async (req, res) => {
  try {
    const { text, fileName, rate, language } = req.body;

    console.log('=== TTS Request ===');
    console.log('Text:', text);
    console.log('File name:', fileName);
    console.log('Rate:', rate);
    console.log('Language received:', language);

    if (!text) {
      return res.status(400).json({ message: 'No text provided' });
    }

    const finalFileName = fileName || 'tts-audio';
    const tempDir = path.join(__dirname, '..', 'temp');
    const audioPath = path.join(tempDir, `${finalFileName}-${Date.now()}.mp3`);
    const mp3Path = path.join(tempDir, `${finalFileName}.mp3`);

    // Create temp directory if it doesn't exist
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Check if language is Romanian - use Google TTS, otherwise use Windows TTS
    if (language === 'ro-RO') {
      console.log('Using Google TTS for Romanian');
      
      // Get Google TTS URL
      const url = gtts.getAudioUrl(text, {
        lang: 'ro',
        slow: false,
        host: 'https://translate.google.com',
      });

      console.log('Google TTS URL:', url);

      // Download audio from Google TTS
      await new Promise((resolve, reject) => {
        const file = fs.createWriteStream(audioPath);
        https.get(url, (response) => {
          response.pipe(file);
          file.on('finish', () => {
            file.close();
            console.log('Google TTS audio downloaded');
            resolve();
          });
        }).on('error', (err) => {
          fs.unlink(audioPath, () => {});
          console.error('Download error:', err);
          reject(err);
        });
      });

      // Rename to final MP3 path
      fs.renameSync(audioPath, mp3Path);

    } else {
      // Use Windows TTS for English
      console.log('Using Windows TTS for English');
      
      const wavPath = path.join(tempDir, `${finalFileName}-${Date.now()}.wav`);
      
      const voiceMap = {
        'en-US': 'Microsoft David Desktop',
        'en-GB': 'Microsoft Zira Desktop',
      };

      const selectedVoice = language ? voiceMap[language] : 'Microsoft David Desktop';
      console.log('Mapped voice:', selectedVoice);

      // Generate WAV file using Windows TTS
      await new Promise((resolve, reject) => {
        const speed = rate || 1.0;
        
        say.export(text, selectedVoice, speed, wavPath, (err) => {
          if (err) {
            console.error('TTS error with voice:', selectedVoice, err);
            // Fallback to default voice if selected voice fails
            say.export(text, null, speed, wavPath, (err2) => {
              if (err2) {
                console.error('TTS error with default voice:', err2);
                reject(err2);
              } else {
                console.log('TTS WAV generated with default voice');
                resolve();
              }
            });
          } else {
            console.log('TTS WAV generated with voice:', selectedVoice);
            resolve();
          }
        });
      });

      // Convert WAV to MP3 using FFmpeg
      await new Promise((resolve, reject) => {
        ffmpeg(wavPath)
          .toFormat('mp3')
          .audioBitrate('128k')
          .audioFrequency(44100)
          .on('end', () => {
            console.log('WAV to MP3 conversion completed');
            // Delete WAV file
            if (fs.existsSync(wavPath)) fs.unlinkSync(wavPath);
            resolve();
          })
          .on('error', (err) => {
            console.error('FFmpeg error:', err);
            reject(err);
          })
          .save(mp3Path);
      });
    }

    // Send MP3 file
    res.download(mp3Path, `${finalFileName}.mp3`, (err) => {
      // Cleanup temp files after download
      if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);
      
      if (err) {
        console.error('Download error:', err);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Error sending file' });
        }
      }
    });

  } catch (error) {
    console.error('TTS generation error:', error);
    res.status(500).json({ 
      message: 'Error generating TTS audio',
      error: error.message 
    });
  }
});

// Save TTS-generated MP3 to database
router.post('/save-tts-to-db', authMiddleware, async (req, res) => {
  try {
    const { text, fileName, language } = req.body;

    console.log('=== Save TTS to DB Request ===');
    console.log('Text:', text);
    console.log('File name:', fileName);
    console.log('Language:', language);
    console.log('User ID:', req.userId);

    if (!text) {
      return res.status(400).json({ message: 'No text provided' });
    }

    const finalFileName = fileName || 'tts-audio';
    const tempDir = path.join(__dirname, '..', 'temp');
    const audioPath = path.join(tempDir, `${finalFileName}-${Date.now()}.mp3`);

    // Create temp directory if it doesn't exist
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Generate MP3 using Google TTS for Romanian
    if (language === 'ro-RO') {
      console.log('Using Google TTS for Romanian');
      
      const url = gtts.getAudioUrl(text, {
        lang: 'ro',
        slow: false,
        host: 'https://translate.google.com',
      });

      await new Promise((resolve, reject) => {
        const file = fs.createWriteStream(audioPath);
        https.get(url, (response) => {
          response.pipe(file);
          file.on('finish', () => {
            file.close();
            console.log('Google TTS audio downloaded');
            resolve();
          });
        }).on('error', (err) => {
          fs.unlink(audioPath, () => {});
          reject(err);
        });
      });

    } else {
      // Use Windows TTS for English
      console.log('Using Windows TTS for English');
      
      const wavPath = path.join(tempDir, `${finalFileName}-${Date.now()}.wav`);
      
      const voiceMap = {
        'en-US': 'Microsoft David Desktop',
        'en-GB': 'Microsoft Zira Desktop',
      };

      const selectedVoice = voiceMap[language] || 'Microsoft David Desktop';

      await new Promise((resolve, reject) => {
        say.export(text, selectedVoice, 1.0, wavPath, (err) => {
          if (err) {
            say.export(text, null, 1.0, wavPath, (err2) => {
              if (err2) reject(err2);
              else resolve();
            });
          } else {
            resolve();
          }
        });
      });

      // Convert WAV to MP3
      await new Promise((resolve, reject) => {
        ffmpeg(wavPath)
          .toFormat('mp3')
          .audioBitrate('128k')
          .audioFrequency(44100)
          .on('end', () => {
            if (fs.existsSync(wavPath)) fs.unlinkSync(wavPath);
            resolve();
          })
          .on('error', (err) => reject(err))
          .save(audioPath);
      });
    }

    // Read MP3 file as buffer
    const audioBuffer = fs.readFileSync(audioPath);

    // Save to MongoDB with correct schema fields
    const newMP3 = new MP3({
      filename: `${finalFileName}.mp3`,
      data: audioBuffer,  // Buffer, not Base64
      contentType: 'audio/mpeg',
      user: req.user._id,  // Use req.user._id like in upload function
      uploadDate: new Date()
    });

    await newMP3.save();

    // Cleanup temp file
    if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);

    console.log('TTS MP3 saved to database successfully');

    res.status(201).json({ 
      message: 'MP3 salvat cu succes în baza de date!',
      mp3Id: newMP3._id
    });

  } catch (error) {
    console.error('Error saving TTS to DB:', error);
    res.status(500).json({ 
      message: 'Eroare la salvarea MP3-ului',
      error: error.message 
    });
  }
});

// Voice cloning endpoint - converts user's voice to celebrity voice
router.post('/clone-voice', authMiddleware, upload.single('audioFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No audio file provided' });
    }

    const { targetVoice } = req.body;
    const tempDir = path.join(__dirname, '..', 'temp');
    const inputPath = path.join(tempDir, `input-${Date.now()}.webm`);
    const convertedPath = path.join(tempDir, `converted-${Date.now()}.wav`);
    const outputPath = path.join(tempDir, `cloned-${Date.now()}.mp3`);

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Save input file
    fs.writeFileSync(inputPath, req.file.buffer);

    // Convert to WAV for processing
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .toFormat('wav')
        .audioChannels(1)
        .audioFrequency(16000)
        .on('end', resolve)
        .on('error', reject)
        .save(convertedPath);
    });

    console.log('Processing voice cloning for:', targetVoice);

    // Call Python voice cloning service
    const pythonServiceUrl = 'http://localhost:5001/clone';
    
    const formData = require('form-data');
    const axios = require('axios');
    const form = new formData();
    form.append('audio', fs.createReadStream(convertedPath));
    form.append('target_voice', targetVoice);

    try {
      const response = await axios.post(pythonServiceUrl, form, {
        headers: form.getHeaders(),
        responseType: 'arraybuffer',
        timeout: 300000 // 5 minute timeout for processing
      });

      // Save the cloned audio
      fs.writeFileSync(outputPath, response.data);

      // Send back to client
      res.download(outputPath, `cloned-${targetVoice}.mp3`, (err) => {
        // Cleanup
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(convertedPath)) fs.unlinkSync(convertedPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        
        if (err) {
          console.error('Download error:', err);
          if (!res.headersSent) {
            res.status(500).json({ message: 'Error sending file' });
          }
        }
      });

    } catch (pythonError) {
      console.error('Python service error:', pythonError.message);
      
      // Cleanup on error
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(convertedPath)) fs.unlinkSync(convertedPath);
      
      res.status(503).json({ 
        message: 'Voice cloning service unavailable. Please ensure Python service is running on port 5001.',
        error: pythonError.message 
      });
    }

  } catch (error) {
    console.error('Voice cloning error:', error);
    res.status(500).json({ 
      message: 'Error processing voice cloning',
      error: error.message 
    });
  }
});

module.exports = router;
