const mongoose = require("mongoose");
const { type } = require("os");

const userschema = new mongoose.Schema({
  userName: {
    type: String,
    require: true,
  },
  profileImageUrl: {
    type: String,
    require: true,
  },

  Id: {
    type: String,
    require: true,
  },
  userEmail: {
    type: String,
    require: true,
  },

  password: {
    type: String,
    require: true,
  },
  deviceAnalysisData: {
    type: Array,
    default:[]
  },

  productsListed:{
    type: Array,
    default:[]
  },
  productBought:{
    type: Array,
    default:[]
  },
  productSold:{
    type: Array,
    default:[]
  },
  cart:{
    type: Array,
    default:[]
  },
  rating:{
    type: Number,
    default:0
  },
  reviews:{
    type: Array,
    default:[]
    
  }

  
});

const user = mongoose.model("eWasteManagmentData", userschema);

module.exports = user;
