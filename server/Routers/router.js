//Test Data
// [
//   {
//     "deviceName": "iPhone 13 Pro Max",
//     "modelNumber": "A2643",
//     "issue": "Face ID not working, camera lens cracked"
//   },
//   {
//     "deviceName": "Dell Inspiron 15 3000",
//     "modelNumber": "3511",
//     "issue": "Battery not charging, overheating"
//   },
//   {
//     "deviceName": "Samsung Galaxy S21 Ultra",
//     "modelNumber": "SM-G998B",
//     "issue": "Cracked screen, battery draining fast"
//   },
//   {
//     "deviceName": "HP Pavilion x360",
//     "modelNumber": "14-dh1026TU",
//     "issue": "Broken hinge, keyboard not working"
//   }
// ]

const express = require("express");
const { GoogleGenAI } = require("@google/genai");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const router = express.Router();
const authMiddleware = require("../Middlewares/middleware");
const bcrypt = require("bcrypt");
const { V2 } = require("paseto");
const ChatGroup = require("../Schema/ChatGroup");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const { ref, uploadBytes, getDownloadURL } = require("firebase/storage");
const { storage } = require("../firebase");
const { v4: uuidv4 } = require("uuid");
const dotenv = require("dotenv");
const user = require("../Schema/schema");

dotenv.config();
const GEMINI_API_KEY = process.env.AI_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const FIREBASE_BUCKET = process.env.FIREBASE_BUCKET;
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

async function uploadToFirebase(base64Data, fileName) {
  try {
    const folderPath = "Component-Image-Storage-electronic-Managment";
    const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_BUCKET}/o/${encodeURIComponent(
      `${folderPath}/${fileName}`,
    )}?uploadType=media&name=${folderPath}/${fileName}&key=${FIREBASE_API_KEY}`;

    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: Buffer.from(base64Data, "base64"),
    });

    await res.json();

    return `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_BUCKET}/o/${encodeURIComponent(
      `${folderPath}/${fileName}`,
    )}?alt=media`;
  } catch (error) {
    console.error(" Firebase upload failed:", error);
    return null;
  }
}

async function generateComponentImage(partName, deviceName) {
  try {
    const prompt = `High quality studio photo of ${partName} from ${deviceName}, isolated on a white background, well lit, product photography style`;

    // Using Stable Diffusion XL model
    const response = await fetch(
      "https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-xl-base-1.0",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: prompt }),
      },
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(err);
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString("base64");

    const safeFileName = `${deviceName}_${partName}.png`.replace(/\s+/g, "_");
    return await uploadToFirebase(base64Image, safeFileName);
  } catch (err) {
    console.error("Image generation error:", err);
    return null;
  }
}

//Analyze Device & Generate Images
router.post("/analyze-device-image", async (req, res) => {
  try {
    const { deviceName, modelNumber, issue } = req.body;

    if (!deviceName || !modelNumber || !issue) {
      return res.status(400).json({ error: "Missing parameters" });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `
    You are a certified electronics hardware engineer.

Analyze the given device and issue, and list:
1. All **working components** of this specific model that are likely still functional (EACH AND EVERY) with internal components ALSO.
2. All **non-working components** that are likely damaged or need replacement.

 Strict output rules:
- Include only **actual component hardware names and codes** for that exact model (for example: "Battery Pack 49.9 Wh (A2179)", "Logic Board 820-02016-A", "Trackpad 821-02519-A").
- Do NOT add words like "likely", "functional", "assume", or "description".
- Do NOT include any explanation, text, or markdown.
- Output strictly valid JSON only in this format:

{
  "workable_parts": ["<Model name/part number>", "<Model name/Part Number>", ...],
  "damaged_parts": ["<Model name/Part Number>", "<Model name/Part Number>", ...]
}

Device: ${deviceName}
Model Number: ${modelNumber}
Issue: ${issue}
`;

    const result = await model.generateContent(prompt);
    let text = result.response.text();

    let parts;
    try {
      parts = JSON.parse(text);
    } catch {
      const match = text.match(/{[\s\S]*}/);
      parts = match
        ? JSON.parse(match[0])
        : { workable_parts: [], damaged_parts: [] };
    }

    const damaged_parts_with_images = [];
    for (const part of parts.damaged_parts || []) {
      const imageUrl = await generateComponentImage(part, deviceName);
      damaged_parts_with_images.push({
        name: part,
        imageUrl,
      });
    }

    res.json({
      success: true,
      device: `${deviceName} ${modelNumber}`,
      workable_parts: parts.workable_parts || [],
      damaged_parts: damaged_parts_with_images,
    });
  } catch (err) {
    console.error("Server Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//Analyze Device Parts only
router.post("/analyze-device-parts", async (req, res) => {
  try {
    const { deviceName, modelNumber, issue } = req.body;

    if (!deviceName || !modelNumber || !issue) {
      return res.status(400).json({
        error: "Please provide deviceName, modelNumber, and issue.",
      });
    }

    const prompt = `
    You are a certified electronics hardware engineer.

Analyze the given device and issue, and list:
1. All **working components** of this specific model that are likely still functional (EACH AND EVERY) with internal components ALSO.
2. All **non-working components** that are likely damaged or need replacement.

 Strict output rules:
- Include only **actual component hardware names and codes** for that exact model (for example: "Battery Pack 49.9 Wh (A2179)", "Logic Board 820-02016-A", "Trackpad 821-02519-A").
- Do NOT add words like "likely", "functional", "assume", or "description".
- Do NOT include any explanation, text, or markdown.
- Output strictly valid JSON only in this format:

{
  "workable_parts": ["<Model name/part number>", "<Model name/Part Number>", ...],
  "damaged_parts": ["<Model name/Part Number>", "<Model name/Part Number>", ...]
}

Device: ${deviceName}
Model Number: ${modelNumber}
Issue: ${issue}
`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);

    let text = result.response.text();

    text = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = { raw_response: text };
    }

    res.json({
      success: true,
      device: `${deviceName} ${modelNumber}`,
      analysis: data,
    });
  } catch (error) {
    console.error("Error analyzing device:", error);
    res.status(500).json({ error: "Something went wrong with Gemini API." });
  }
});

//Get all Listed Products (from user productsListed array)
router.get("/products", authMiddleware, async (req, res) => {
  try {
    const products = await user.find({});
    const listedProducts = products.map((usr) => usr.productsListed).flat();
    res.status(200).json({ products: listedProducts });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//Get product by ID
router.get("/products/:id", authMiddleware, async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await user.findOne({ Id: productId });
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.status(200).json({ product: product });
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
// Add to Cart
router.post("/cart/add:productId", authMiddleware, async (req, res) => {
  try {
    const productId = req.params.productId;
    const userId = req.user.id;
    const User = await user.findById({ userId: userId });
    if (!User) {
      return res.status(404).json({ message: "User not found" });
    }

    const cartItems = [...User.cart, productId];
    const updatedCart = await user.findByIdAndUpdate(
      { userId: userId },
      { cart: cartItems },
      { new: true },
    );

    res
      .status(200)
      .json({ message: "Product added to cart", cart: updatedCart.cart });
  } catch (error) {
    console.error("Error adding to cart:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//List a Product
router.post("/listProduct", authMiddleware, async (req, res) => {
  const { name, quantity, description, price, imageUrl } = req.body;
  const userId = req.user.id;
  try {
    const newProduct = {
      productId: uuidv4(),
      name,
      quantity,
      description,
      price,
      imageUrl,
      rating: 0,
    };

    const updatedUser = await user.findByIdAndUpdate(
      { Id: userId },
      { $push: { productsListed: newProduct } },
      { new: true },
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({
      product: newProduct,
    });
  } catch (error) {
    console.error("Error", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// listedProducts:{
// productId: String,
// name: String,
// quantity: Number,
// description: String,
// price: Number,
// imageUrl: Array,
// }

//List Product with Chat Group Creation
router.post("/listProductWithChat", authMiddleware, async (req, res) => {
  const { name, quantity, description, price, imageUrl } = req.body;
  const userId = req.user.id; 

  try {
    const newProduct = {
      productId: uuidv4(),
      name,
      quantity,
      description,
      price,
      imageUrl,
      rating: 0,
    };

    const updatedUser = await user.findOneAndUpdate(
      { Id: userId },
      { $push: { productsListed: newProduct } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }   
    const chatGroup = await ChatGroup.create({
      productId: newProduct.productId,
      productName: newProduct.name,
      sellerId: updatedUser._id,
      participants: [],
    });

    updatedUser.chatGroups.push(chatGroup._id);
    await updatedUser.save();

    res.status(200).json({
      product: newProduct,
      chatGroupId: chatGroup._id,
      message: "Product listed & chat group created",
    });
  } catch (error) {
    console.error("Error listing product:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//Get Cart Items
router.get("/getCartItems", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const User = await user.findById({ userId: userId });
    if (!User) {
      return res.status(404).json({ message: "User not found" });
    }
    const usersProducts = await User.find({}, { productsListed: 1, _id: 0 });
    const productsUserArray = [usersProducts];
    const CartProductDetails = User.cart.map((id) =>
      productsUserArray
        .flatMap((item) => item.productsListed)
        .find((prod) => prod.productId === id),
    );

    res.status(200).json({ cartData: CartProductDetails });
  } catch (error) {
    console.error("Error fetching cart items:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//Cart Value
router.get("/cartValue", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const User = await user.findById({ userId: userId });
    if (!User) {
      return res.status(404).json({ message: "User not found" });
    }
    const cartProducts = await user.find({ Id: { $in: User.cart } });

    const numbers = cartProducts.map((product) => product.price);

    const cartTotalAmount = numbers.reduce(
      (accumulator, currentValue) => accumulator + currentValue,
      0,
    );
    res.status(200).json({ cartValue: cartTotalAmount });
  } catch (error) {
    console.error("Error fetching cart value:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
//Remove from Cart
router.post('/:id/removeFromCart', async (req, res) => {
  try {
    const { userId } = req.body;
    const productId = req.params.id;

    const User = await user.findByIdAndUpdate(
      userId,
      { $pull: { cart: productId } },
      { new: true }
    ).populate('cart');

    res.status(200).json({  
      message: 'Product removed from cart',
      cart: User.cart
    });
  } catch (error) {
    res.status(400).json({
      message: 'Error removing from cart',
      error: error.message
    });
  }
});


//Seller reviews and ratings
router.post("/submitReview", authMiddleware, async (req, res) => {
  const { sellerId, rating, review } = req.body;
  const userId = req.user.id;

  try {
    const seller = await user.findOne({ Id: sellerId });
    if (!seller) {
      return res.status(404).json({ message: "Seller not found" });
    }
    const newReview = {
      reviewerId: userId,
      rating: rating,
      review: review,
    };
    seller.reviews.push(newReview);
    const totalRatings = seller.reviews.reduce((sum, r) => sum + r.rating, 0);
    seller.rating = totalRatings / seller.reviews.length;
    await seller.save();
    res.status(200).json({
      review: newReview,
      updatedRating: seller.rating,
      allReviews: seller.reviews,
      userId: userId,
    });
  } catch (error) {
    console.error("Error submitting review:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//Get Seller Reviews
router.get("/sellerReviews/:sellerId", authMiddleware, async (req, res) => {
  const sellerId = req.params.sellerId;
  try {
    const seller = await user.findOne({ Id: sellerId });
    if (!seller) {
      return res.status(404).json({ message: "Seller not found" });
    }
    const totalReviews = seller.reviews.length;
    if (totalReviews === 0) {
      return res.status(200).json({ reviews: [], rating: 0, totalReviews: 0 });
    }
    res
      .status(200)
      .json({ reviews: seller.reviews, rating: seller.rating, totalReviews });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//View user profile
router.get("/userProfile/:userId", authMiddleware, async (req, res) => {
  const userId = req.params.userId;
  try {
    const User = await user.findOne({ Id: userId });
    if (!User) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({
      userName: User.userName,
      productSold: User.productSold.length || 0,
      rating: User.rating,
      reviews: User.reviews,
      profileImageUrl: User.profileImageUrl,
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//Search Products

// listedProducts:{
// productId: String,
// name: String,
// quantity: Number,
// description: String,
// price: Number,
// imageUrl: Array,
// }
//search?name=productname ==>URL Format
router.get("/search", async (req, res) => {
  try {
    const { name } = req.query;

    if (!name) {
      return res.status(400).json({ error: "Product name required" });
    }

    const pipeline = [
      { $unwind: "$productsListed" },
      {
        $match: {
          $text: { $search: name },
        },
      },
      {
        $project: {
          _id: 0,
          sellerId: "$Id",
          sellerName: "$userName",
          product: "$productsListed",
        },
      },
      { $limit: 20 },
    ];

    const results = await user.aggregate(pipeline);

    res.status(200).json({
      count: results.length,
      results,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Search failed" });
  }
});

//AI Search Products
//aiSearch?query=productname =>URL Format
router.post("/aiSearch", async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: "Query required" });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `
You are a product search assistant.

Extract the MOST RELEVANT product name from the user's request.

User query:
"${query}"

Return ONLY a JSON like:
{ "name": "product name" }
`;

    const aiResponse = await model.generateContent(prompt);
    const aiText = aiResponse.response.text();

    const { name } = JSON.parse(aiText);

    const pipeline = [
      { $unwind: "$productsListed" },
      {
        $match: {
          $text: { $search: name },
        },
      },
      {
        $project: {
          _id: 0,
          sellerId: "$Id",
          sellerName: "$userName",
          product: "$productsListed",
        },
      },
      { $limit: 20 },
    ];

    const results = await user.aggregate(pipeline);

    res.json({
      interpretedName: name,
      count: results.length,
      results,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Search failed" });
  }
});

module.exports = router;
