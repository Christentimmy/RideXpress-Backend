import axios from "axios";
import dotenv from "dotenv";
import Notification from "../models/notification_model";
import mongoose from "mongoose";

dotenv.config();

const sendPushNotification = async (
  oneSignalId: string,
  message: string,
  userId: mongoose.Types.ObjectId,
  data: any = {},
  buttons: any[] = []
) => {
  const oneSignalAppId = process.env.ONESIGNAL_APP_ID;
  const oneSignalApiKey = process.env.ONESIGNAL_API_KEY;

  const payload = {
    app_id: oneSignalAppId,
    include_player_ids: [oneSignalId],
    headings: { en: "Notification" },
    contents: { en: message },
    data,
    buttons,
  };

  try {
    await axios.post("https://onesignal.com/api/v1/notifications", payload, {
      headers: {
        Authorization: `Basic ${oneSignalApiKey}`,
        "Content-Type": "application/json",
      },
    });
    await Notification.create({ userId, message });
  } catch (error: any) {
    console.error(
      "Error sending notification:",
      error.response?.data || error.message
    );
  }
};


export default sendPushNotification;
