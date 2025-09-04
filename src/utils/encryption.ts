import crypto from "crypto";

const algorithm = "aes-256-cbc";
const key = Buffer.from(process.env.ENCRYPTION_KEY!, "hex"); 
const ivLength = 16;

export function encrypt(text: string) {
    const iv = crypto.randomBytes(ivLength);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    return {
        iv: iv.toString("hex"),
        data: encrypted,
    };
}

export function decrypt(encrypted: string | null | undefined, iv: string | null | undefined): string | null {
    // Check if either encrypted or iv is null/undefined/empty
    if (!encrypted || !iv) {
        console.warn('Decryption failed: Missing encrypted data or IV');
        return null;
    }

    try {
        const ivBuffer = Buffer.from(iv, 'hex');
        if (ivBuffer.length !== ivLength) {
            throw new Error('Invalid IV length');
        }

        const decipher = crypto.createDecipheriv(algorithm, key, ivBuffer);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        console.error('Decryption error:', error);
        return null;
    }
}
