import { Server } from "socket.io";
import { socketController } from "../controllers/socket_controller";
import authenticateSocket from "../middlewares/socket_middleware";
import Ride from "../models/ride_model";
import User from "../models/user_model";
import { IRide } from "../types/ride_type";

let io: Server;

export const onlineUsers = new Map<string, string>();

export function setupSocket(server: any) {
    io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
        },
    });

    // Apply middleware
    io.use(authenticateSocket);

    // Handle connection
    io.on("connection", async (socket) => {
        console.log("User connected:", socket.data.user.id);
        const userId = socket.data.user.id;
        const user = await User.findById(userId);

        // Update user as online
        const updatedUser = await User.findByIdAndUpdate(userId, { availability_status: "online" }, { new: true });
        // console.log("Updated user status to online:", updatedUser);

        socketController.updateLocation(io, socket);


        // Check if the user already has a socket connected
        if (onlineUsers.has(userId)) {
            const existingSocketId = onlineUsers.get(userId);
            if (existingSocketId && existingSocketId !== socket.id) {
                const existingSocket = io.sockets.sockets.get(existingSocketId);
                if (existingSocket) {
                    existingSocket.disconnect(true);
                }
            }
        }

        socket.join(userId);


        // Register new connection
        onlineUsers.set(userId, socket.id);

        socket.emit("userDetails", { data: user });

        //Typing
        socketController.joinRoom(io, socket);
        socketController.chatHandler(io, socket);
        socketController.startTyping(io, socket, userId);
        socketController.stopTyping(io, socket, userId);

        // 🚀 Fetch and join active rides on connection
        const activeRides = await Ride.find({
            $or: [{ rider: userId }, { driver: userId }],
            status: "accepted",
        });

        activeRides.forEach((ride: IRide) => {
            socket.join(ride._id.toString());
        });

        socket.on("disconnect", async () => {
            console.log("User disconnected:", socket.data.user.id);
            await User.findByIdAndUpdate(userId, { availability_status: "offline" });
        });
    });

    return io;
}

export { io };