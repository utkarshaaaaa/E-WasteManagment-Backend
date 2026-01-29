const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    chatGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatGroup",
      required: true,
    },

    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "eWasteManagmentData",
      required: true,
    },

    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "eWasteManagmentData",
      required: true,
    },

    message: {
      type: String,
      required: true,
    },

    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);
const Message = mongoose.model("Message", messageSchema);
module.exports = Message;
