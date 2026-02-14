const express = require("express");
const router = express.Router();
const { V2 } = require("paseto");
const user = require("../Schema/schema");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const authMiddleware = require("../Middlewares/middleware");

dotenv.config();

const PRIVATE_KEY = process.env.PASETO_PRIVATE_KEY.replace(/\\n/g, "\n");

//Test Route
router.get("/test", (req, res) => {
  res.json({ message: "Test route!" });
});

//User Register
router.post("/register", async (req, res) => {
  try {
    const { userName, userEmail, password } = req.body;

    const exist = await user.findOne({ userEmail });
    if (exist)
      return res.status(400).json({ message: "Email already registered" });

    const hashed = await bcrypt.hash(password, 10);
    const User = new user({ userName, userEmail, password: hashed });
    await User.save();

    res.json({ message: "User registered successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
});

// User Login
router.post("/login", async (req, res) => {
  try {
    const { userEmail, password } = req.body;

    const User = await user.findOne({ userEmail });
    if (!User) return res.status(400).json({ message: "User not found" });

    const match = await bcrypt.compare(password, User.password);
    if (!match) return res.status(401).json({ message: "Invalid credentials" });

    const token = await V2.sign(
      {
        id: User._id.toString(),
        userEmail: User.userEmail,
        userName: User.userName,
        reviews: User.reviews,
        productSold: User.productSold,
        productsListed: User.productsListed,
        rating: User.rating,
      },
      PRIVATE_KEY,
      { expiresIn: "1h" },
    );

    res.cookie("access_token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 1000,
    });

    res.status(200).json({ message: "Login successful", token: token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});
//Logout Route
router.post("/logout", (req, res) => {
  res.clearCookie("access_token", {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
  });

  res.json({ message: "Logged out" });
});

router.get("/user", authMiddleware, (req, res) => {
  res.json({
    message: "Authorized",
    user: req.user,
  });
});

module.exports = router;
