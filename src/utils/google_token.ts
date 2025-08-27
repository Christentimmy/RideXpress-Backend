import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function verifyGoogleToken(token: string) {
  const ticket = await client.verifyIdToken({
    idToken: token,
    audience: process.env.GOOGLE_CLIENT_ID!,
  });

  const payload = ticket.getPayload();
  if (!payload) throw new Error("Invalid Google token");

  return {
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
    sub: payload.sub, // Google user id
  };
}
