const { Router } = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const multer = require('multer');
const router = Router();
const MP3 = require('../models/mp3');
const mongoose = require('mongoose');

require("dotenv").config();
const SECRET_KEY1 = process.env.SECRET_KEY; 

const storage = multer.memoryStorage(); 

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'audio/mpeg') {
      cb(null, true);
    } else {
      cb(new Error('Doar fișiere MP3 sunt permise!'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // Limita 10MB
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
  if (!req.file) {
    return res.status(400).send({ message: 'No file uploaded or invalid file type' });
  }

  const mp3 = new MP3({
    filename: req.file.originalname,
    data: req.file.buffer,
    contentType: req.file.mimetype,
    user: req.user._id 
  });

  try {
    await mp3.save();
    res.status(200).send({ 
      message: 'File uploaded successfully', 
      file: mp3._id
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Error saving file to database' });
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


router.get('/mp3/:id', async (req, res) => {
  try {
    const mp3 = await MP3.findById(req.params.id);
    if (!mp3) {
      return res.status(404).send({ message: 'File not found' });
    }
    res.set('Content-Type', mp3.contentType);
    res.send(mp3.data);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Error retrieving file from database' });
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
                         .select('filename _id uploadDate');
    res.status(200).send(files);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Error retrieving files list' });
  }
});

router.put('/edit-mp3/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { filename } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: "ID invalid",
        code: "INVALID_ID"
      });
    }


    if (!filename) {
      return res.status(400).json({ message: 'Filename is required' });
    }

    const mp3 = await MP3.findById(id);
    
    if (!mp3) {
      return res.status(404).json({ message: 'File not found' });
    }

    if (mp3.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    mp3.filename = filename;
    await mp3.save();

    res.status(200).json({
      message: 'File updated successfully',
      file: {
        _id: mp3._id,
        filename: mp3.filename,
        uploadDate: mp3.uploadDate
      }
    });

  } catch (error) {
    console.error('Edit error:', error);
    res.status(500).json({ message: 'Server error' });
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


router.post('/logout', async (req, res) => {
  console.log("Received POST request to /logout"); 
  res.cookie("jwt", "", { maxAge: 0 });
  res.send({
    message: "Successfully logged out"
  });
});

module.exports = router;
