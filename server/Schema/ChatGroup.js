const mongoose = require('mongoose');

const chatGroupSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    unique: true
  },
  productName: {
    type: String,
    required: true
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'eWasteManagmentData', 
    required: true
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'eWasteManagmentData'
  }],
  lastMessage: {
    type: String,
    default: ''
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  
  unreadCount: {
    type: Map,
    of: Number,
    default: {}
  }
}, {
  timestamps: true
});

chatGroupSchema.index({ productId: 1 });
chatGroupSchema.index({ seller: 1 });
chatGroupSchema.index({ participants: 1 });

const ChatGroup = mongoose.model('ChatGroup', chatGroupSchema);
module.exports = ChatGroup;
