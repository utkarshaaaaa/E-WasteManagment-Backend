const express = require("express");
const router = express.Router();
const authMiddleware = require("../Middlewares/middleware");
const ChatGroup = require("../Schema/ChatGroup");
const Message = require("../Schema/MessageSchema");
const user = require("../Schema/schema");


//Buyer send message to seller
router.post("/buyer/send", authMiddleware, async (req, res) => {
  try {
    const { chatGroupId, message } = req.body;
    const buyerAuthId = req.user.id;

    if (!chatGroupId || !message) {
      return res.status(400).json({ error: "Missing parameters" });
    }

    const buyer = await user.findOne({ Id: buyerAuthId });
    if (!buyer) return res.status(404).json({ error: "Buyer not found" });

    const chatGroup = await ChatGroup.findById(chatGroupId);
    if (!chatGroup) {
      return res.status(404).json({ error: "Chat group not found" });
    }

    if (chatGroup.isClosed) {
      return res.status(403).json({ error: "Chat is closed" });
    }

    if (chatGroup.sellerId.toString() === buyer._id.toString()) {
      return res.status(403).json({ error: "Seller cannot use buyer route" });
    }

    const alreadyJoined = chatGroup.participants.find(
      (p) => p.userId.toString() === buyer._id.toString()
    );

    if (!alreadyJoined) {
      chatGroup.participants.push({ userId: buyer._id, unreadCount: 0 });
    }

    const newMessage = await Message.create({
      chatGroupId: chatGroup._id,
      senderId: buyer._id,
      receiverId: chatGroup.sellerId,
      message,
    });

    chatGroup.lastMessage = message;
    chatGroup.lastMessageAt = new Date();
    await chatGroup.save();

    req.io.to(chatGroupId).emit("newMessage", newMessage);

    res.status(200).json({
      success: true,
      data: newMessage,
    });
  } catch (error) {
    console.error("Buyer send error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// Buyer fetches messages in a chat group
router.get("/buyer/:chatGroupId", authMiddleware, async (req, res) => {
  try {
    const buyerAuthId = req.user.id;
    const { chatGroupId } = req.params;

    const buyer = await user.findOne({ Id: buyerAuthId });
    if (!buyer) return res.status(404).json({ error: "Buyer not found" });

    const messages = await Message.find({
      chatGroupId,
      $or: [{ senderId: buyer._id }, { receiverId: buyer._id }],
    }).sort({ createdAt: 1 });

    res.json({messages: messages});
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

//Seller fetches messages in a chat group
router.get("/seller/:chatGroupId", authMiddleware, async (req, res) => {
  try {
    const sellerAuthId = req.user.id;
    const { chatGroupId } = req.params;

    const seller = await user.findOne({ Id: sellerAuthId });
    if (!seller) return res.status(404).json({ error: "Seller not found" });

    const chatGroup = await ChatGroup.findById(chatGroupId);
    if (!chatGroup) return res.status(404).json({ error: "Chat not found" });

    if (chatGroup.sellerId.toString() !== seller._id.toString()) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const messages = await Message.find({ chatGroupId })
      .populate("senderId", "userName profileImageUrl")
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch seller messages" });
  }
});

//Seller replies to buyer
router.post("/seller/reply", authMiddleware, async (req, res) => {
  try {
    const { chatGroupId, buyerId, message } = req.body;
    const sellerAuthId = req.user.id;

    const seller = await user.findOne({ Id: sellerAuthId });
    const chatGroup = await ChatGroup.findById(chatGroupId);

    if (!seller || !chatGroup) {
      return res.status(404).json({ error: "Data not found" });
    }

    if (
      chatGroup.sellerId.toString() !== seller._id.toString() ||
      chatGroup.isClosed
    ) {
      return res.status(403).json({ error: "Unauthorized or chat closed" });
    }

    const msg = await Message.create({
      chatGroupId,
      senderId: seller._id,
      receiverId: buyerId,
      message,
    });

    const participant = chatGroup.participants.find(
      (p) => p.userId.toString() === buyerId
    );
    if (participant) participant.unreadCount += 1;

    chatGroup.lastMessage = message;
    chatGroup.lastMessageAt = new Date();
    await chatGroup.save();

    req.io.to(chatGroupId).emit("newMessage", msg);

    res.json(msg);
  } catch (error) {
    res.status(500).json({ error: "Reply failed" });
  }
});

//Merk messages as read
router.post("/read", authMiddleware, async (req, res) => {
  try {
    const { chatGroupId } = req.body;
    const authId = req.user.id;

    const userToMark = await user.findOne({ Id: authId });
    const chatGroup = await ChatGroup.findById(chatGroupId);

    if (!userToMark || !chatGroup) {
      return res.status(404).json({ error: "Data not found" });
    }

    const participant = chatGroup.participants.find(
      (p) => p.userId.toString() === userToMark._id.toString()
    );

    if (participant) participant.unreadCount = 0;

    await Message.updateMany(
      { chatGroupId, receiverId: userToMark._id },
      { isRead: true }
    );

    await chatGroup.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to mark read" });
  }
});

//Close chat group (seller only)
router.post("/close/:productId", authMiddleware, async (req, res) => {
  try {
    const chat = await ChatGroup.findOne({
      productId: req.params.productId,
    });

    if (!chat) return res.status(404).json({ error: "Chat not found" });

    chat.isClosed = true;
    await chat.save();

    res.json({ message: "Chat closed successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to close chat" });
  }
});

// Seller fetches all their chat groups
router.get("/seller/groups", authMiddleware, async (req, res) => {
  const seller = await user.findOne({ Id: req.user.id });

  const chats = await ChatGroup.find({ sellerId: seller._id })
    .populate("participants.userId", "userName")
    .sort({ lastMessageAt: -1 });

  res.json({chats: chats});
});

module.exports = router;
