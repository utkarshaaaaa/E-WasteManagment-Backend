const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userschema = new mongoose.Schema(
  {
    userName: {
      type: String,
      required: true,
    },
    profileImageUrl: {
      type: String,
      // required: true,
    },
    Id: {
      type: String,
      // required: true,
    },
    userEmail: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    deviceAnalysisData: {
      type: Array,
      default: [],
    },
    productsListed: {
      type: Array,
      default: [],
    },
    productBought: {
      type: Array,
      default: [],
    },
    productSold: {
      type: Array,
      default: [],
    },
    cart: {
      type: Array,
      default: [],
    },
    rating: {
      type: Number,
      default: 0,
    },
    reviews: {
      type: Array,
      default: [],
    },

    chatGroups: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ChatGroup",
      },
    ],

    totalUnreadMessages: {
      type: Number,
      default: 0,
    },

    lastActive: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

const user = mongoose.model("eWasteManagmentData", userschema);

module.exports = user;
