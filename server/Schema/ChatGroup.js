// models/ChatGroup.js
const mongoose = require("mongoose");

const chatGroupSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      required: true,
    },
    productName: {
      type: String,
      required: true,
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "eWasteManagmentData",
    },

    participants: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "eWasteManagmentData",
        },
        unreadCount: { type: Number, default: 0 },
      },
    ],

    lastMessage: String,
    lastMessageAt: Date,

    isClosed: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const ChatGroup = mongoose.model("ChatGroup", chatGroupSchema);
module.exports = ChatGroup;