const express = require("express");
const router = express.Router();
const authMiddleware = require("../Middlewares/middleware");
const ChatGroup = require("../Schema/ChatGroup");
const Message = require("../Schema/MessageSchema");
const user = require("../Schema/schema");



// Chats Routes

// Get or create chat group for a product (Buyer)
router.get("/product/:productId", authMiddleware, async (req, res) => {
  try {
    const { productId } = req.params;
    const buyerAuthId = req.user.id;

    const buyer = await user.findOne({ _id: buyerAuthId });
    if (!buyer) return res.status(404).json({ error: "Buyer not found" });

    // Find existing chat group for this product
    let chatGroup = await ChatGroup.findOne({ productId });

    if (!chatGroup) {
      return res.status(404).json({ error: "Chat group not found" });
    }
    
    const alreadyJoined = chatGroup.participants.find(
      (p) => p._id.toString() === buyer._id.toString()
    );

    if (!alreadyJoined) {
      chatGroup.participants.push({ userId: buyer._id, unreadCount: 0 });
      await chatGroup.save();
    }

    res.json({ chatGroupId: chatGroup._id });
  } catch (error) {
    console.error("Error getting chat group:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Buyer send message
router.post("/buyer/send", authMiddleware, async (req, res) => {
  try {
    const { chatGroupId, message } = req.body;
    const buyerAuthId = req.user.id;

    if (!chatGroupId || !message) {
      return res.status(400).json({ error: "Missing parameters" });
    }

    const buyer = await user.findOne({ _id: buyerAuthId });
    if (!buyer) return res.status(404).json({ error: "Buyer not found" });

    const chatGroup = await ChatGroup.findById(chatGroupId);
    if (!chatGroup) {
      return res.status(404).json({ error: "Chat group not found" });
    }

    if (chatGroup.isClosed) {
      return res.status(403).json({ error: "Chat is closed" });
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

    if (req.io) {
      req.io.to(chatGroupId).emit("newMessage", newMessage);
    }

    res.status(200).json({
      success: true,
      data: newMessage,
    });
  } catch (error) {
    console.error("Buyer send error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Buyer fetches messages
router.get("/buyer/:chatGroupId", authMiddleware, async (req, res) => {
  try {
    const buyerAuthId = req.user.id;
    const { chatGroupId } = req.params;

    const buyer = await user.findOne({ _id: buyerAuthId });
    if (!buyer) return res.status(404).json({ error: "Buyer not found" });

    const messages = await Message.find({
      chatGroupId,
      $or: [{ senderId: buyer._id }, { receiverId: buyer._id }],
    }).sort({ createdAt: 1 });

    res.json({ messages: messages });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// Seller fetches messages
router.get("/seller/:chatGroupId", authMiddleware, async (req, res) => {
  try {
    const sellerAuthId = req.user.id;
    const { chatGroupId } = req.params;

    const seller = await user.findOne({ _id: sellerAuthId });
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

// Seller replies
router.post("/seller/reply", authMiddleware, async (req, res) => {
  try {
    const { chatGroupId, buyerId, message } = req.body;
    const sellerAuthId = req.user.id;

    const seller = await user.findOne({ _id: sellerAuthId });
    const chatGroup = await ChatGroup.findById(chatGroupId);

    if (!seller || !chatGroup) {
      return res.status(404).json({ error: "Data not found" });
    }

    if (chatGroup.sellerId.toString() !== seller._id.toString()) {
      return res.status(403).json({ error: "Unauthorized" });
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

    if (req.io) {
      req.io.to(chatGroupId).emit("newMessage", msg);
    }

    const populated = await Message.findById(msg._id).populate("senderId", "userName profileImageUrl");
    res.json(populated);
  } catch (error) {
    res.status(500).json({ error: "Reply failed" });
  }
});

// Mark as read
router.post("/read", authMiddleware, async (req, res) => {
  try {
    const { chatGroupId } = req.body;
    const authId = req.user.id;

    const userToMark = await user.findOne({ _id: authId });
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

// Close chat
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

// Seller fetches all groups
router.get("/seller/groups", authMiddleware, async (req, res) => {
  try {
    const seller = await user.findOne({ _id: req.user.id });

    const chats = await ChatGroup.find({ sellerId: seller._id })
      .populate("participants.userId", "userName")
      .sort({ lastMessageAt: -1 });

    res.json({ chats: chats });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch groups" });
  }
});

router.post("/get-or-create-group", authMiddleware, async (req, res) => {
  try {
    const { productId } = req.body;
    
    if (!productId) {
      return res.status(400).json({ error: "Product ID is required" });
    }
    
    const buyerAuthId = req.user.id;

    const buyer = await user.findOne({ _id: buyerAuthId });
    if (!buyer) return res.status(404).json({ error: "User not found" });

    const allUsers = await user.find({});
    let productInfo = null;
    let sellerId = null;

    for (const usr of allUsers) {
      const product = usr.productsListed.find(p => p.productId === productId);
      if (product) {
        productInfo = product;
        sellerId = usr._id;
        break;
      }
    }

    if (!productInfo || !sellerId) {
      return res.status(404).json({ error: "Product not found" });
    }

    if (sellerId.toString() === buyer._id.toString()) {
      return res.status(403).json({ error: "Cannot chat with your own product" });
    }

    let chatGroup = await ChatGroup.findOne({ productId });

    if (!chatGroup) {
      chatGroup = await ChatGroup.create({
        productId: productInfo.productId,
        productName: productInfo.name,
        sellerId: sellerId,
        participants: [],
        lastMessageAt: new Date()
      });

      await user.findByIdAndUpdate(sellerId, {
        $addToSet: { chatGroups: chatGroup._id }
      });
    }

    const alreadyParticipant = chatGroup.participants.find(
      p => p.userId.toString() === buyer._id.toString()
    );

    if (!alreadyParticipant) {
      chatGroup.participants.push({ userId: buyer._id, unreadCount: 0 });
      await chatGroup.save();

      await user.findByIdAndUpdate(buyer._id, {
        $addToSet: { chatGroups: chatGroup._id }
      });
    }

    res.json({
      success: true,
      chatGroup: {
        _id: chatGroup._id,
        productId: chatGroup.productId,
        productName: chatGroup.productName,
        sellerId: chatGroup.sellerId
      }
    });
  } catch (error) {
    console.error("Get/Create group error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Send Message (Buyer or Seller)
router.post("/send-message", authMiddleware, async (req, res) => {
  try {
    const { chatGroupId, message } = req.body;
    const senderAuthId = req.user.id;

    if (!chatGroupId || !message) {
      return res.status(400).json({ error: "Missing parameters" });
    }

    const sender = await user.findOne({ _id: senderAuthId });
    if (!sender) return res.status(404).json({ error: "User not found" });

    const chatGroup = await ChatGroup.findById(chatGroupId);
    if (!chatGroup) {
      return res.status(404).json({ error: "Chat group not found" });
    }

    if (chatGroup.isClosed) {
      return res.status(403).json({ error: "Chat is closed" });
    }

    // Determine if sender is seller or buyer
    const isSeller = chatGroup.sellerId.toString() === sender._id.toString();
    
    let receiverId;
    if (isSeller) {
      // Seller is replying to all buyers (broadcast)
      receiverId = null; // We'll handle this differently
    } else {
      // Buyer is sending to seller
      receiverId = chatGroup.sellerId;
      
      // Add buyer to participants if not already
      const alreadyParticipant = chatGroup.participants.find(
        p => p.userId.toString() === sender._id.toString()
      );
      if (!alreadyParticipant) {
        chatGroup.participants.push({ userId: sender._id, unreadCount: 0 });
      }
    }

    const newMessage = await Message.create({
      chatGroupId: chatGroup._id,
      senderId: sender._id,
      receiverId: isSeller ? chatGroup.sellerId : receiverId,
      message,
    });

    // Populate sender info
    await newMessage.populate('senderId', 'userName profileImageUrl');

    // Update unread counts for participants
    if (!isSeller) {
      // Buyer sent message, increment seller's unread
      chatGroup.participants.forEach(p => {
        if (p.userId.toString() !== sender._id.toString()) {
          p.unreadCount += 1;
        }
      });
    } else {
      // Seller sent message, increment all buyers' unread
      chatGroup.participants.forEach(p => {
        p.unreadCount += 1;
      });
    }

    chatGroup.lastMessage = message;
    chatGroup.lastMessageAt = new Date();
    await chatGroup.save();

    // Emit socket event if io is available
    if (req.io) {
      req.io.to(chatGroupId).emit("newMessage", newMessage);
    }

    res.status(200).json({
      success: true,
      message: newMessage
    });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get Messages for Chat Group
router.get("/messages/:chatGroupId", authMiddleware, async (req, res) => {
  try {
    const { chatGroupId } = req.params;
    const userAuthId = req.user.id;

    const currentUser = await user.findOne({ _id: userAuthId });
    if (!currentUser) return res.status(404).json({ error: "User not found" });

    const chatGroup = await ChatGroup.findById(chatGroupId);
    if (!chatGroup) return res.status(404).json({ error: "Chat not found" });

    // Check if user is seller or participant
    const isSeller = chatGroup.sellerId.toString() === currentUser._id.toString();
    const isParticipant = chatGroup.participants.some(
      p => p.userId.toString() === currentUser._id.toString()
    );

    if (!isSeller && !isParticipant) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const messages = await Message.find({ chatGroupId })
      .populate("senderId", "userName profileImageUrl")
      .sort({ createdAt: 1 });

    // Mark messages as read
    await Message.updateMany(
      { 
        chatGroupId, 
        receiverId: currentUser._id,
        isRead: false 
      },
      { isRead: true }
    );

    // Reset unread count for this user
    const participant = chatGroup.participants.find(
      p => p.userId.toString() === currentUser._id.toString()
    );
    if (participant) {
      participant.unreadCount = 0;
      await chatGroup.save();
    }

    res.json({
      success: true,
      messages
    });
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// Get User's Chat Groups
router.get("/my-chats", authMiddleware, async (req, res) => {
  try {
    const userAuthId = req.user.id;
    const currentUser = await user.findOne({ _id: userAuthId });
    if (!currentUser) return res.status(404).json({ error: "User not found" });

    // Find chats where user is seller or participant
    const chats = await ChatGroup.find({
      $or: [
        { sellerId: currentUser._id },
        { 'participants.userId': currentUser._id }
      ]
    })
      .populate('sellerId', 'userName profileImageUrl')
      .populate('participants.userId', 'userName profileImageUrl')
      .sort({ lastMessageAt: -1 });

    // Format chats with unread count
    const formattedChats = chats.map(chat => {
      const isSeller = chat.sellerId._id.toString() === currentUser._id.toString();
      
      let unreadCount = 0;
      if (!isSeller) {
        const participant = chat.participants.find(
          p => p.userId._id.toString() === currentUser._id.toString()
        );
        unreadCount = participant ? participant.unreadCount : 0;
      } else {
        // For seller, sum all participants' unread
        unreadCount = chat.participants.reduce((sum, p) => sum + p.unreadCount, 0);
      }

      return {
        _id: chat._id,
        productId: chat.productId,
        productName: chat.productName,
        sellerId: chat.sellerId,
        participants: chat.participants,
        lastMessage: chat.lastMessage,
        lastMessageAt: chat.lastMessageAt,
        isClosed: chat.isClosed,
        unreadCount,
        isSeller,
        participantCount: chat.participants.length
      };
    });

    res.json({
      success: true,
      chats: formattedChats
    });
  } catch (error) {
    console.error("Get chats error:", error);
    res.status(500).json({ error: "Failed to fetch chats" });
  }
});

// Get Chat Group Info
router.get("/chat-info/:chatGroupId", authMiddleware, async (req, res) => {
  try {
    const { chatGroupId } = req.params;
    const userAuthId = req.user.id;

    const currentUser = await user.findOne({ _id: userAuthId });
    if (!currentUser) return res.status(404).json({ error: "User not found" });

    const chatGroup = await ChatGroup.findById(chatGroupId)
      .populate('sellerId', 'userName profileImageUrl')
      .populate('participants.userId', 'userName profileImageUrl');

    if (!chatGroup) return res.status(404).json({ error: "Chat not found" });

    const isSeller = chatGroup.sellerId._id.toString() === currentUser._id.toString();

    res.json({
      success: true,
      chatInfo: {
        _id: chatGroup._id,
        productId: chatGroup.productId,
        productName: chatGroup.productName,
        sellerId: chatGroup.sellerId,
        participants: chatGroup.participants,
        isClosed: chatGroup.isClosed,
        isSeller,
        participantCount: chatGroup.participants.length
      }
    });
  } catch (error) {
    console.error("Get chat info error:", error);
    res.status(500).json({ error: "Failed to fetch chat info" });
  }
});

// Close Chat (Seller Only)
router.post("/close-chat/:chatGroupId", authMiddleware, async (req, res) => {
  try {
    const { chatGroupId } = req.params;
    const userAuthId = req.user.id;

    const currentUser = await user.findOne({ _id: userAuthId });
    const chatGroup = await ChatGroup.findById(chatGroupId);

    if (!currentUser || !chatGroup) {
      return res.status(404).json({ error: "Data not found" });
    }

    if (chatGroup.sellerId.toString() !== currentUser._id.toString()) {
      return res.status(403).json({ error: "Only seller can close chat" });
    }

    chatGroup.isClosed = true;
    await chatGroup.save();

    res.json({ 
      success: true,
      message: "Chat closed successfully" 
    });
  } catch (error) {
    console.error("Close chat error:", error);
    res.status(500).json({ error: "Failed to close chat" });
  }
});




















// //Buyer send message to seller
// router.post("/buyer/send", authMiddleware, async (req, res) => {
//   try {
//     const { chatGroupId, message } = req.body;
//     const buyerAuthId = req.user.id;

//     if (!chatGroupId || !message) {
//       return res.status(400).json({ error: "Missing parameters" });
//     }

//     const buyer = await user.findOne({ Id: buyerAuthId });
//     if (!buyer) return res.status(404).json({ error: "Buyer not found" });

//     const chatGroup = await ChatGroup.findById(chatGroupId);
//     if (!chatGroup) {
//       return res.status(404).json({ error: "Chat group not found" });
//     }

//     if (chatGroup.isClosed) {
//       return res.status(403).json({ error: "Chat is closed" });
//     }

//     if (chatGroup.sellerId.toString() === buyer._id.toString()) {
//       return res.status(403).json({ error: "Seller cannot use buyer route" });
//     }

//     const alreadyJoined = chatGroup.participants.find(
//       (p) => p.userId.toString() === buyer._id.toString()
//     );

//     if (!alreadyJoined) {
//       chatGroup.participants.push({ userId: buyer._id, unreadCount: 0 });
//     }

//     const newMessage = await Message.create({
//       chatGroupId: chatGroup._id,
//       senderId: buyer._id,
//       receiverId: chatGroup.sellerId,
//       message,
//     });

//     chatGroup.lastMessage = message;
//     chatGroup.lastMessageAt = new Date();
//     await chatGroup.save();

//     req.io.to(chatGroupId).emit("newMessage", newMessage);

//     res.status(200).json({
//       success: true,
//       data: newMessage,
//     });
//   } catch (error) {
//     console.error("Buyer send error:", error);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });


// // Buyer fetches messages in a chat group
// router.get("/buyer/:chatGroupId", authMiddleware, async (req, res) => {
//   try {
//     const buyerAuthId = req.user.id;
//     const { chatGroupId } = req.params;

//     const buyer = await user.findOne({ Id: buyerAuthId });
//     if (!buyer) return res.status(404).json({ error: "Buyer not found" });

//     const messages = await Message.find({
//       chatGroupId,
//       $or: [{ senderId: buyer._id }, { receiverId: buyer._id }],
//     }).sort({ createdAt: 1 });

//     res.json({messages: messages});
//   } catch (error) {
//     res.status(500).json({ error: "Failed to fetch messages" });
//   }
// });

// //Seller fetches messages in a chat group
// router.get("/seller/:chatGroupId", authMiddleware, async (req, res) => {
//   try {
//     const sellerAuthId = req.user.id;
//     const { chatGroupId } = req.params;

//     const seller = await user.findOne({ Id: sellerAuthId });
//     if (!seller) return res.status(404).json({ error: "Seller not found" });

//     const chatGroup = await ChatGroup.findById(chatGroupId);
//     if (!chatGroup) return res.status(404).json({ error: "Chat not found" });

//     if (chatGroup.sellerId.toString() !== seller._id.toString()) {
//       return res.status(403).json({ error: "Unauthorized" });
//     }

//     const messages = await Message.find({ chatGroupId })
//       .populate("senderId", "userName profileImageUrl")
//       .sort({ createdAt: 1 });

//     res.json(messages);
//   } catch (error) {
//     res.status(500).json({ error: "Failed to fetch seller messages" });
//   }
// });

// //Seller replies to buyer
// router.post("/seller/reply", authMiddleware, async (req, res) => {
//   try {
//     const { chatGroupId, buyerId, message } = req.body;
//     const sellerAuthId = req.user.id;

//     const seller = await user.findOne({ Id: sellerAuthId });
//     const chatGroup = await ChatGroup.findById(chatGroupId);

//     if (!seller || !chatGroup) {
//       return res.status(404).json({ error: "Data not found" });
//     }

//     if (
//       chatGroup.sellerId.toString() !== seller._id.toString() ||
//       chatGroup.isClosed
//     ) {
//       return res.status(403).json({ error: "Unauthorized or chat closed" });
//     }

//     const msg = await Message.create({
//       chatGroupId,
//       senderId: seller._id,
//       receiverId: buyerId,
//       message,
//     });

//     const participant = chatGroup.participants.find(
//       (p) => p.userId.toString() === buyerId
//     );
//     if (participant) participant.unreadCount += 1;

//     chatGroup.lastMessage = message;
//     chatGroup.lastMessageAt = new Date();
//     await chatGroup.save();

//     req.io.to(chatGroupId).emit("newMessage", msg);

//     res.json(msg);
//   } catch (error) {
//     res.status(500).json({ error: "Reply failed" });
//   }
// });

// //Merk messages as read
// router.post("/read", authMiddleware, async (req, res) => {
//   try {
//     const { chatGroupId } = req.body;
//     const authId = req.user.id;

//     const userToMark = await user.findOne({ Id: authId });
//     const chatGroup = await ChatGroup.findById(chatGroupId);

//     if (!userToMark || !chatGroup) {
//       return res.status(404).json({ error: "Data not found" });
//     }

//     const participant = chatGroup.participants.find(
//       (p) => p.userId.toString() === userToMark._id.toString()
//     );

//     if (participant) participant.unreadCount = 0;

//     await Message.updateMany(
//       { chatGroupId, receiverId: userToMark._id },
//       { isRead: true }
//     );

//     await chatGroup.save();
//     res.json({ success: true });
//   } catch (error) {
//     res.status(500).json({ error: "Failed to mark read" });
//   }
// });

// //Close chat group (seller only)
// router.post("/close/:productId", authMiddleware, async (req, res) => {
//   try {
//     const chat = await ChatGroup.findOne({
//       productId: req.params.productId,
//     });

//     if (!chat) return res.status(404).json({ error: "Chat not found" });

//     chat.isClosed = true;
//     await chat.save();

//     res.json({ message: "Chat closed successfully" });
//   } catch (error) {
//     res.status(500).json({ error: "Failed to close chat" });
//   }
// });

// // Seller fetches all their chat groups
// router.get("/seller/groups", authMiddleware, async (req, res) => {
//   const seller = await user.findOne({ Id: req.user.id });

//   const chats = await ChatGroup.find({ sellerId: seller._id })
//     .populate("participants.userId", "userName")
//     .sort({ lastMessageAt: -1 });

//   res.json({chats: chats});
// });

module.exports = router;
