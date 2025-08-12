import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const sendPushNotification = async (oneSignalId: string, message: string) => {
  const oneSignalAppId = process.env.ONESIGNAL_APP_ID;
  const oneSignalApiKey = process.env.ONESIGNAL_API_KEY;

  const payload = {
    app_id: oneSignalAppId,
    include_player_ids: [oneSignalId],
    headings: { en: 'Notification Title' },
    contents: { en: message }
  };

  try {
    const response = await axios.post(
      'https://onesignal.com/api/v1/notifications',
      payload,
      {
        headers: {
          Authorization: `Basic ${oneSignalApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('Notification sent:', response.data);
  } catch (error: any) {
    console.error('Error sending notification:', error.response?.data || error.message);
  }
};

export default sendPushNotification;