import jwt from "jsonwebtoken";
import { Socket } from "socket.io";
import User from "../models/user_model";

const authenticateSocket = async (socket: Socket, next: (err?: any) => void) => {
    try {
        const token = socket.handshake.headers.authorization?.split(" ")[1];

        if (!token) {
            return next(new Error("Authentication error: No token provided"));
        }

        // Verify the token
        const decoded: any = jwt.verify(token, process.env.TOKEN_SECRET as string);

        const user = await User.findById(decoded.id);

        if (!user) {
            return next(new Error("Authentication error: User not found"));
        }

        socket.data.user = user;
        next();
    } catch (error) {
        next(new Error("Authentication error: Invalid token"));
    }
};

export default authenticateSocket;
