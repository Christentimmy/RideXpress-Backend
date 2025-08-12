import mongoose, { Document } from "mongoose";

export interface IMessage extends Document {
  senderId: mongoose.Types.ObjectId;
  receiverId: mongoose.Types.ObjectId;
  message?: string | null;
  messageType: string;
  mediaUrl?: string | null;
  status: string;
  iv?: string | null;
  mediaIv?: string | null;
  timestamp: Date;
  clientGeneratedId?: string;
  isDeleted?: boolean;
  isEdited?: boolean;
  avater?: string;
  replyToMessage?: IMessage | null;
  replyToMessageId?: mongoose.Types.ObjectId | null;
  multipleImages: {
    mimetype: string;
    mediaUrl: string;
    mediaIv: string;
    filename: string;
  }[];
}
