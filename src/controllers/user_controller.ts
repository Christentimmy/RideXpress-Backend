import { Request, Response } from "express";
import User from "../models/user_model";
import Ride from "../models/ride_model";

export const userController = {
    uploadProfile: async (req: Request, res: Response) => {
        try {
            const userId = res.locals.userId;
            const user = await User.findById(userId);
            if (!user) {
                res.status(404).json({ message: "User not found" });
                return;
            }
            if (!req.file) {
                res.status(400).json({ message: "No file uploaded" });
                return;
            }
            user.avatar = req.file.path;
            await user.save();
            res.status(200).json({ message: "Profile updated successfully" });

        } catch (error) {
            console.log(error);
            res.status(500).json({ message: "Internal server error" });
        }
    },

    getUserAddress: async (req: Request, res: Response) => {
        try {
            const userId = res.locals.userId;
            const user = await User.findById(userId);
            if (!user) {
                res.status(404).json({ message: "User not found" });
                return;
            }
            res.status(200).json({ address: user.address });
        } catch (error) {
            console.log(error);
            res.status(500).json({ message: "Internal server error" });
        }
    },

    saveAddress: async (req: Request, res: Response) => {
        try {
            const { address } = req.body;
            if (!address) {
                res.status(400).json({ message: "Address is required" });
                return;
            }
            const userId = res.locals.userId;
            const user = await User.findById(userId);
            if (!user) {
                res.status(404).json({ message: "User not found" });
                return;
            }
            user.address.push(address);
            await user.save();
            res.status(200).json({ message: "Address saved successfully" });
        } catch (error) {
            console.log(error);
            res.status(500).json({ message: "Internal server error" });
        }
    },

    findNearByDrivers: async (req: Request, res: Response) => {
        try {
            const { carType, carSeat, fromLocation } = req.body;

            if (!carType || !carSeat || !fromLocation) {
                res.status(400).json({ message: "All fields are required" });
                return;
            }

            let currentRide = await Ride.findOne({
                rider: res.locals.userId,
                status: "pending",
            });

            const declinedDrivers = currentRide?.excluded_drivers || [];

            const closestDriver = await User.findOne({
                _id: { $nin: declinedDrivers },
                role: "driver",
                account_status: "active",
                availability_status: "online",
                "driverProfile.carType": carType,
                "driverProfile.carSeat": { $gte: carSeat },
                location: {
                    $near: {
                        $geometry: {
                            type: 'Point',
                            coordinates: fromLocation,
                        },
                        $maxDistance: 10000, // 10 km
                    },
                },
            }).select("driverProfile avatar first_name last_name email rating ")
                .lean();

            if (!closestDriver) {
                res.status(404).json({ message: "No driver found" });
                return;
            }

            if (!currentRide) {
                const ride = new Ride({
                    rider: res.locals.userId,
                    driver: closestDriver._id,
                    status: "pending",
                    pickup_location: fromLocation,
                    dropoff_location: fromLocation,
                    fare: 0,
                    requested_at: new Date(),
                    payment_status: "pending",
                    amount_paid: 0,
                    rated: false,
                    excluded_drivers: [],
                });
                await ride.save();
                currentRide = ride;
            } else {
                await Ride.findByIdAndUpdate(currentRide._id, {
                    driver: closestDriver._id,
                });
            }

            res.status(200).json({
                message: "Driver found",
                data: {
                    driver: closestDriver,
                    ride: currentRide,
                }
            });
        } catch (error) {
            console.log(error);
            res.status(500).json({ message: "Internal server error" });
        }
    },

    getCurrentRide: async (req: Request, res: Response) => {
        try {
            const userId = res.locals.userId;
            if (!userId) {
                res.status(400).json({ message: "User not authenticated" });
                return;
            }
            const ride = await Ride.findOne({
                rider: userId,
                $or: [
                    { status: { $in: ["pending", "accepted", "progress", "paused", "panic"] } },
                    { status: "ended", payment_status: { $ne: "paid" } }
                ]
            }).populate("driver", "driverProfile avatar first_name last_name email rating")
                .populate("rider", "avatar first_name last_name email")
                .sort({ requested_at: -1 });

            if (!ride) {
                res.status(404).json({ message: "No ride found" });
                return;
            }
            res.status(200).json({ message: "Ride found", data: ride });
        } catch (error) {
            console.log(error);
            res.status(500).json({ message: "Internal server error" });
        }
    },

    rateDriver: async (req: Request, res: Response) => {
        try {
            if (!req.body) {
                res.status(400).json({ message: "All fields are required" });
                return;
            }
            const user = res.locals.user;
            if (!user) {
                res.status(400).json({ message: "User not authenticated" });
                return;
            }

            const { driverId, rating, comment } = req.body;
            if (!driverId || !rating || !comment) {
                res.status(400).json({ message: "All fields are required" });
                return;
            }

            const ride = await Ride.findOne({
                rider: user._id,
                driver: driverId,
                status: "completed",
                payment_status: "paid",
            });

            if (!ride) {
                res.status(400).json({ message: "Ride not found" });
                return;
            }

            if (ride.rated) {
                res.status(400).json({ message: "Driver already rated" });
                return;
            }

            await Ride.findByIdAndUpdate(ride._id, { rated: true });

            if (rating < 1 || rating > 5) {
                res.status(400).json({ message: "Rating must be between 1 and 5" });
                return;
            }

            const driver = await User.findById(driverId).select("rating").lean();
            if (!driver) {
                res.status(400).json({ message: "Driver not found" });
                return;
            }

            const currentTotal = driver.rating.total || 0;
            const currentAvg = driver.rating.avg || 0;

            const updatedTotal = currentTotal + 1;
            const updatedAvg = ((currentAvg * currentTotal) + rating) / updatedTotal;

            await User.findByIdAndUpdate(driverId, {
                $set: { "rating.avg": Number(updatedAvg.toFixed(1)) },
                $inc: { "rating.total": 1 }
            });

            

            res.status(200).json({ message: "Driver rated successfully" });
        } catch (error) {
            console.log(error);
            res.status(500).json({ message: "Internal server error" });
        }
    },

};