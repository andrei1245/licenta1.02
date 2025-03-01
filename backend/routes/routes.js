const { Router } = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const multer = require('multer');
const router = Router();
const MP3 = require('../models/mp3');

require("dotenv").config();
const SECRET_KEY1 = process.env.SECRET_KEY; // Adaugă această linie!

const storage = multer.memoryStorage(); // Use memory storage instead of disk storage

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
    fileSize: 10 * 1024 * 1024 // Limită 10MB
  }
});

router.post('/upload', upload.single('mp3'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send({ message: 'No file uploaded or invalid file type' });
  }

  const mp3 = new MP3({
    filename: req.file.originalname,
    data: req.file.buffer,
    contentType: req.file.mimetype
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

router.get('/mp3s', async (req, res) => {
  try {
    const files = await MP3.find().select('filename _id uploadDate'); // Selectează doar câmpurile necesare
    res.status(200).send(files);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Error retrieving files list' });
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
    console.log("Cookies received:", req.cookies); // Verifică ce cookie-uri primește serverul

    const cookie = req.cookies.jwt;

    if (!cookie) {
      return res.status(401).send({ message: "unauthenticated - no cookie" });
    }

    const claims = jwt.verify(cookie, SECRET_KEY1); // Corect

    if (!claims) {
      return res.status(401).send({ message: "unauthenticated - invalid JWT" });
    }

    const user = await User.findOne({ _id: claims._id });

    if (!user) {
      return res.status(401).send({ message: "unauthenticated - user not found" });
    }

    const { password, ...data } = user.toJSON(); // Corect
    res.send(data);

  } catch (err) {
    console.error("JWT verification error:", err);
    return res.status(401).send({ message: "unauthenticated - error in processing" });
  }
});


router.post('/logout', async (req, res) => {
  console.log("Received POST request to /logout"); // Debug
  res.cookie("jwt", "", { maxAge: 0 });
  res.send({
    message: "Successfully logged out"
  });
});

module.exports = router;
