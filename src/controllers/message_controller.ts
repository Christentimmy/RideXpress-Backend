import { Request, Response } from "express";
import Message from "../models/message_model";
import userSchema from "../models/user_model";
import { onlineUsers } from "../config/socket";
import { decrypt, encrypt } from "../utils/encryption";

export const messageController = {
  sendMessage: async (req: Request, res: Response) => {
    if (!req.body) {
      res.status(400).json({ message: "Request body is required" });
      return;
    }
    const { receiverId, message, messageType = "text" } = req.body;
    const senderId = res.locals.userId;

    if (!receiverId || !message) {
      res.status(400).json({ message: "Receiver and message are required" });
      return;
    }

    try {
      const newMessage = new Message({
        senderId,
        receiverId,
        message,
        messageType,
        status: "sent",
      });

      await newMessage.save();

      res
        .status(201)
        .json({ message: "Message sent successfully", data: newMessage });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to send message", error });
    }
  },

  getMessageHistory: async (req: Request, res: Response) => {
    try {
      const userId = res.locals.userId;
      const { rideId } = req.params;

      if (!rideId) {
        res.status(400).json({ message: "Ride ID is required" });
        return;
      }

      const messages = await Message.find({
        rideId,
        $or: [{ senderId: userId }, { receiverId: userId }],
      })
        .sort({ timestamp: 1 })
        .exec();

      // Decrypt messages and media URLs
      const decryptedMessages = messages.map((msg) => {
        try {
          if (msg?.message !== null && msg?.iv !== null) {
            msg.message = decrypt(msg.message!, msg.iv!);
          }
          if (
            msg?.replyToMessage &&
            msg.replyToMessage.message !== null &&
            msg.replyToMessage.iv !== null
          ) {
            msg.replyToMessage.message = decrypt(
              msg.replyToMessage.message!,
              msg.replyToMessage.iv!
            );
          }
        } catch (e) {
          console.log(e);
        }

        try {
          if (msg?.mediaUrl !== null && msg?.mediaIv !== null) {
            msg.mediaUrl = decrypt(msg.mediaUrl!, msg.mediaIv!);
          }
          if (
            msg?.replyToMessage &&
            msg.replyToMessage.mediaUrl !== null &&
            msg.replyToMessage.mediaIv !== null
          ) {
            msg.replyToMessage.mediaUrl = decrypt(
              msg.replyToMessage.mediaUrl!,
              msg.replyToMessage.mediaIv!
            );
          }
        } catch (e) {
          console.log(e);
        }
        if (msg.multipleImages && msg.multipleImages.length > 0) {
          msg.multipleImages = msg.multipleImages.map((image) => {
            try {
              const decryptedUrl = decrypt(image.mediaUrl, image.mediaIv);
              return {
                ...image,
                mediaUrl: decryptedUrl || image.mediaUrl, // Fallback to original if decryption fails
              };
            } catch (e) {
              console.log('Error decrypting image URL:', e);
              return image; // Return the original image if decryption fails
            }
          }).filter((image): image is { mimetype: string; mediaUrl: string; mediaIv: string; filename: string } => {
            return image.mediaUrl !== null && image.mediaUrl !== undefined;
          });
        }

        if (
          msg.replyToMessage &&
          msg.replyToMessage.multipleImages &&
          msg.replyToMessage.multipleImages.length > 0
        ) {
          msg.replyToMessage.multipleImages = 
            msg.replyToMessage.multipleImages.map((image) => {
              try {
                const decryptedUrl = decrypt(image.mediaUrl, image.mediaIv);
                return {
                  ...image,
                  mediaUrl: decryptedUrl || image.mediaUrl, // Fallback to original if decryption fails
                };
              } catch (e) {
                console.log('Error decrypting reply image URL:', e);
                return image; // Return the original image if decryption fails
              }
            }).filter((image): image is { mimetype: string; mediaUrl: string; mediaIv: string; filename: string } => {
              return image.mediaUrl !== null && image.mediaUrl !== undefined;
            });
        }
        return msg;
      });

      res
        .status(200)
        .json({ message: "chat history", data: decryptedMessages });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ message: "Failed to retrieve message history", error });
    }
  },

  markMessageAsRead: async (req: Request, res: Response) => {
    try {
      const { messageId } = req.params;

      const message = await Message.findById(messageId);

      if (!message) {
        res.status(404).json({ message: "Message not found" });
        return;
      }

      if (message.status === "read") {
        res.status(400).json({ message: "Message already marked as read" });
        return;
      }

      message.status = "read";
      await message.save();

      res
        .status(200)
        .json({ message: "Message marked as read", data: message });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ message: "Failed to mark message as read", error });
    }
  },

  getUnreadMessageCount: async (req: Request, res: Response) => {
    const userId = res.locals.userId;
    const { chatWith } = req.params;

    if (!chatWith) {
      res.status(400).json({ message: "Missing chatWith parameter" });
      return;
    }

    try {
      const unreadCount = await Message.countDocuments({
        receiverId: userId,
        senderId: chatWith,
        status: "sent",
      });

      res.status(200).json({
        message: "unread messages counts",
        unreadMessages: unreadCount,
      });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ message: "Failed to get unread message count", error });
    }
  },

  getChatList: async (req: Request, res: Response) => {
    try {
      const userId = res.locals.userId;
      const messages = await Message.find({
        $or: [{ senderId: userId }, { receiverId: userId }],
      }).sort({ timestamp: -1 });

      const chatMap = new Map<string, any>();
      const maxLastMessageLength = 50;

      messages.forEach((message) => {
        const otherUserId =
          message.senderId.toString() === userId.toString()
            ? message.receiverId.toString()
            : message.senderId.toString();

        let decryptedMessage = message.message;
        // Decrypt text message if it exists and has an IV
        if (message.message && message.iv) {
          try {
            decryptedMessage = decrypt(message.message, message.iv);
          } catch (e) {
            console.warn("Failed to decrypt message", message._id);
          }
        }

        // Decrypt media URL if it exists and has an IV
        let decryptedMediaUrl = message.mediaUrl;
        if (message.mediaUrl && message.mediaIv) {
          try {
            decryptedMediaUrl = decrypt(message.mediaUrl, message.mediaIv);
          } catch (e) {
            console.warn("Failed to decrypt media URL", message._id);
          }
        }

        if (!decryptedMessage && decryptedMediaUrl) {
          decryptedMessage = message.messageType;
        }

        if (!chatMap.has(otherUserId)) {
          chatMap.set(otherUserId, {
            userId: otherUserId,
            lastMessage: decryptedMessage,
            lastMessageTimestamp: message.timestamp,
            unreadCount:
              message.receiverId.toString() === userId.toString() &&
              message.status === "sent"
                ? 1
                : 0,
            mediaUrl: decryptedMediaUrl,
            messageType: message.messageType,
          });
        } else {
          const chatData = chatMap.get(otherUserId);
          if (message.timestamp > chatData.lastMessageTimestamp) {
            chatData.lastMessage = decryptedMessage;
            chatData.mediaUrl = decryptedMediaUrl;
            chatData.messageType = message.messageType;
            chatData.lastMessageTimestamp = message.timestamp;
          }
          if (
            message.receiverId.toString() === userId.toString() &&
            message.status === "sent"
          ) {
            chatData.unreadCount += 1;
          }
        }
      });

      const chatList = await Promise.all(
        Array.from(chatMap.values()).map(async (chat) => {
          const user = await userSchema
            .findById(chat.userId)
            .select("full_name avatar");
          const isOnline = onlineUsers.has(chat.userId);

          // Truncate the last message if it exceeds the maximum length
          const truncatedLastMessage =
            chat.lastMessage && chat.lastMessage.length > maxLastMessageLength
              ? chat.lastMessage.substring(0, maxLastMessageLength) + "..."
              : chat.lastMessage;

          return {
            userId: chat.userId,
            fullName: user?.first_name + " " + user?.last_name,
            avatar: user?.avatar,
            lastMessage: truncatedLastMessage || chat.messageType,
            mediaUrl: chat.mediaUrl,
            messageType: chat.messageType,
            unreadCount: chat.unreadCount,
            online: isOnline,
          };
        })
      );

      res.status(200).json({ message: "Chat List", chatList });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error", error });
    }
  },

  convertFileToMedia: async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ success: false, message: "No file uploaded" });
      return;
    }

    try {
      const mimeType = req.file.mimetype;
      let messageType: string;

      if (mimeType.startsWith("audio/")) {
        messageType = "audio";
      } else if (mimeType.startsWith("video/")) {
        messageType = "video";
      } else {
        messageType = "image";
      }

      // Encrypt the media URL
      const encryptedUrl = encrypt(req.file.path);

      res.json({
        success: true,
        mediaUrl: encryptedUrl.data,
        mediaIv: encryptedUrl.iv,
        public_id: req.file.filename,
        messageType,
      });
    } catch (error) {
      console.error("Upload error:", error);
      res
        .status(500)
        .json({ success: false, message: "File upload failed", error });
    }
  },

  uploadMultipleImages: async (req: Request, res: Response) => {
    try {
      if (!req.files || req.files.length === 0) {
        res.status(400).json({ message: "No file uploaded" });
        return;
      }

      const files = req.files as Express.Multer.File[];
      const urls = files.map((file) => {
        const mimeType = file.mimetype;
        let messageType: string;

        if (mimeType.startsWith("audio/")) {
          messageType = "audio";
        } else if (mimeType.startsWith("video/")) {
          messageType = "video";
        } else {
          messageType = "image";
        }

        // Encrypt the media URL
        const encryptedUrl = encrypt(file.path);
        return {
          public_id: file.filename,
          mimetype: file.mimetype,
          mediaUrl: encryptedUrl.data,
          mediaIv: encryptedUrl.iv,
          messageType,
        };
      });

      res.json({
        success: true,
        mediaObjects: urls,
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ message: "File upload failed", error });
    }
  },
};
