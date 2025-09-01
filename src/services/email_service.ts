import dotenv from "dotenv";
import generateEmailOtpTemplate, { generateEmailTemplate } from "./email_template";
import { Resend } from "resend";

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendOTP(email: string, otp: string) {
    try {
        const result = await resend.emails.send({
            from: process.env.RESEND_FROM!,
            to: email,
            subject: "Your OTP Code",
            html: generateEmailOtpTemplate(otp),
        });
        return { success: true, message: "OTP sent successfully!" };
    } catch (error) {
        console.error("Error sending OTP:", error);
        return { success: false, message: "Failed to send OTP" };
    }
}

export async function sendEmail(email: string, companyName: string, recipientName: string, message: string) {
    try {
        await resend.emails.send({
            from: process.env.RESEND_FROM!,
            to: email,
            subject: "RideXpress",
            html: generateEmailTemplate(companyName, recipientName, message),
        });
        return { success: true, message: "OTP sent successfully!" };
    } catch (error) {
        console.error("Error sending OTP:", error);
        return { success: false, message: "Failed to send OTP" };
    }
}



export async function sendBulkEmail(emails: string[], subject: string, recipientName: string, message: string) {
    try {
        // Send emails in parallel using Promise.all
        const emailPromises = emails.map(email => 
            resend.emails.send({
                from: process.env.RESEND_FROM!,
                to: email,
                subject: subject,
                html: generateEmailTemplate("FastBuss", recipientName, message),
            })
        );

        const results = await Promise.all(emailPromises);
        
        // Count successful and failed emails
        const successful = results.filter(result => result.error === null).length;
        const failed = results.filter(result => result.error !== null).length;

        return {
            success: true,
            message: `Bulk email sent successfully. ${successful} delivered, ${failed} failed.`,
            data: {
                total: emails.length,
                successful,
                failed
            }
        };
    } catch (error) {
        console.error("Error sending bulk email:", error);
        return {
            success: false,
            message: "Failed to send bulk email",
            error
        };
    }
}
