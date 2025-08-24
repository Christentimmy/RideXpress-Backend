import { Server, Socket } from "socket.io";
import User from "../models/user_model";
import Ride from "../models/ride_model";

export const socketController = {

    updateLocation: (io: Server, socket: Socket) => {
        socket.on("updateLocation", async (data: { lat: number; lng: number; address: string }) => {

            try {
                // Validate data
                if (typeof data !== "object" || data === null) {
                    console.error("Invalid data format received:", data);
                    return;
                }

                const { lat, lng, address } = data;

                if (
                    lat === undefined ||
                    lng === undefined ||
                    isNaN(Number(lat)) ||
                    isNaN(Number(lng))
                ) {
                    console.error("Invalid location data received:", data);
                    return;
                }

                if (lat < -90 || lat > 90) {
                    console.error("Invalid latitude value:", lat);
                    return;
                }

                if (lng < -180 || lng > 180) {
                    console.error("Invalid longitude value:", lng);
                    return;
                }

                // Get the driver's user ID from the socket
                const userId = socket.data.user._id;
                if (!userId) {
                    console.error("User ID not found in socket data");
                    return;
                }

                // Find the driver in the database
                const driver = await User.findOne({ user: userId });
                if (!driver) {
                    console.error("Driver not found for user ID:", userId);
                    return;
                }

                // Update driver location in the database
                driver.location = { type: "Point", address: address, coordinates: [lng, lat] };
                await driver.save();

                // Find active ride for this driver
                const ride = await Ride.findOne({
                    driver: driver._id,
                    status: { $in: ["accepted", "progress", "paused"] },
                });

                if (!ride) {
                    console.log("No active ride found for driver:", driver._id);
                    return;
                }

                io.to(ride.rider.toString()).emit("driverLocationUpdated", { lat, lng });
            } catch (error) {
                console.error("Error updating driver location:", error);
            }
        });
    },

    joinRoom: (io: Server, socket: Socket) => {
        socket.on("joinRoom", async (data) => {
            if (typeof data === "string") {
                try {
                    data = JSON.parse(data);
                } catch (error) {
                    console.error("❌ Invalid JSON received:", data);
                    socket.emit("error", { message: "Invalid JSON format" });
                    return;
                }
            }
            const { roomId } = data;

            try {
                const ride = await Ride.findById(roomId);
                if (!ride) {
                    console.error(`❌ Ride not found: ${roomId}`);
                    return;
                }

                const isDriver = ride.driver.toString() === socket.data.user.id;
                const isUser = ride.rider.toString() === socket.data.user.id;

                if (!isDriver && !isUser) {
                    console.error(`❌ Unauthorized to join ride room: ${roomId}`);
                    return;
                }

                socket.join(roomId);
            } catch (error) {
                console.error("❌ Error joining room:", error);
            }
        });
    },

    startTyping: (io: Server, socket: Socket, userId: string) => {
        socket.on('typing', async (data) => {
            if (typeof data === "string") {
                data = JSON.parse(data);
            }
            const receiverId = data["receiverId"];
            if (!receiverId) return;
            io.to(receiverId).emit('typing', { senderId: userId });
        });
    },

    stopTyping: (io: Server, socket: Socket, userId: string) => {
        socket.on('stop-typing', (data) => {
            if (typeof data === "string") {
                data = JSON.parse(data);
            }
            const receiverId = data["receiverId"];
            if (!receiverId) return;
            io.to(receiverId).emit('stop-typing', { senderId: userId });
        });
    },
}
