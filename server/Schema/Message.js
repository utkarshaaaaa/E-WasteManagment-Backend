const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  chatGroupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatGroup',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'eWasteManagmentData', // user model name
    required: true
  },
  senderType: {
    type: String,
    enum: ['seller', 'buyer'],
    required: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'file'],
    default: 'text'
  },
  fileUrl: {
    type: String
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'eWasteManagmentData'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

messageSchema.index({ chatGroupId: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });

messageSchema.post('save', async function(doc) {
  const ChatGroup = mongoose.model('ChatGroup');
  const User = mongoose.model('eWasteManagmentData');
  
  // Update chat group
  const chatGroup = await ChatGroup.findByIdAndUpdate(
    doc.chatGroupId,
    {
      lastMessage: doc.message,
      lastMessageAt: doc.createdAt
    },
    { new: true }
  );
  
  if (chatGroup) {
    for (let participantId of chatGroup.participants) {
      if (participantId.toString() !== doc.sender.toString()) {
        
        await ChatGroup.updateOne(
          { _id: doc.chatGroupId },
          { $inc: { [`unreadCount.${participantId}`]: 1 } }
        );
        
        await User.findByIdAndUpdate(participantId, {
          $inc: { totalUnreadMessages: 1 }
        });
      }
    }
  }
});

module.exports = mongoose.model('Message', messageSchema);
