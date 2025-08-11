import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);


export const sendOtpToUserPhoneNumber = async (userPhoneNumber: any) => {

    try {
        // Generate a 4-digit OTP
        const otp = Math.floor(1000 + Math.random() * 9000);
        const message = `Your OTP code is ${otp}`;
        
        const sentMessage = await client.messages.create({
            body: message,
            to: userPhoneNumber,
            from: process.env.TWILIO_PHONE_NUMBER!.toString(),
        });

        return { success: true, otp };  // Return the OTP so that it can be stored in the user model
    } catch (error) {
        console.error('Error in sending OTP:', error);
        return { success: false, error: 'Failed to send OTP.' };  // Error response if something goes wrong
    }
};


export const checkNumberValidity = async (phoneNumber: string) => {

    try {
        const lookup = await client.lookups.v2.phoneNumbers(phoneNumber).fetch();
        return lookup["valid"];
    } catch (error) {
        console.error('Error fetching lookup:', error);
    }
}
