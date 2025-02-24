const { Router } = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const router = Router();


require("dotenv").config();
const SECRET_KEY1 = process.env.SECRET_KEY; // Adaugă această linie!

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
