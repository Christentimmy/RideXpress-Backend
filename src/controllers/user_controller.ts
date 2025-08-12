import { Request, Response } from "express";
import User from "../models/user_model";
import Ride from "../models/ride_model";
import { IUser } from "../types/user_type";

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

    getUserDetails: async (req: Request, res: Response) => {
        try {
            const userId = res.locals.userId;
            if (!userId) {
                res.status(404).json({ message: "User not found" });
                return;
            }
            const user = await User.findById(userId);
            if (!user) {
                res.status(404).json({ message: "User not found" });
                return;
            }

            const userDetails = {
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                account_status: user.account_status,
                availability_status: user.availability_status,
                is_email_verified: user.is_email_verified,
                is_phone_verified: user.is_phone_verified,
                avatar: user.avatar,
                address: user.address,
                driverProfile: user.driverProfile,
            }

            res.status(200).json({ message: "User-Details-Fetched", data: userDetails });
        } catch (error) {
            console.error(error);
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
            const user = res.locals.user;
            if (user.payment_fine > 0) {
                res.status(400).json({ message: "You have a payment fine" });
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

    getRideHistory: async (req: Request, res: Response) => {
        try {
            const userId = res.locals.userId;
            if (!userId) {
                res.status(400).json({ message: "User not authenticated" });
                return;
            }
            const rides = await Ride.find({
                rider: userId,
            }).populate<{ driver: IUser }>("driver", "driverProfile avatar first_name last_name email rating")
                .populate<{ rider: IUser }>("rider", "avatar first_name last_name email")
                .sort({ requested_at: -1 });
            if (!rides) {
                res.status(404).json({ message: "No ride history found" });
                return;
            }

            const response = rides.map((ride) => {
                return {
                    _id: ride._id,
                    status: ride.status,
                    pickup_location: ride.pickup_location,
                    dropoff_location: ride.dropoff_location,
                    fare: ride.fare,
                    amount_paid: ride.amount_paid,
                    rated: ride.rated,
                    requested_at: ride.requested_at,
                };
            });

            res.status(200).json({ message: "Ride history found", data: response });
        } catch (error) {
            console.log(error);
            res.status(500).json({ message: "Internal server error" });
        }
    },

    getRideById: async (req: Request, res: Response) => {
        try {
            const { rideId } = req.params;
            if (!rideId) {
                res.status(400).json({ message: "Ride id is required" });
                return;
            }
            const ride = await Ride.findById(rideId).populate<{ driver: IUser }>("driver", "driverProfile avatar first_name last_name email rating");


            if (!ride) {
                res.status(404).json({ message: "Ride not found" });
                return;
            }

            const response = {
                _id: ride._id,
                status: ride.status,
                pickup_location: ride.pickup_location,
                dropoff_location: ride.dropoff_location,
                fare: ride.fare,
                amount_paid: ride.amount_paid,
                rated: ride.rated,
                requested_at: ride.requested_at,
                driver: {
                    _id: ride.driver._id,
                    avatar: ride.driver.avatar,
                    first_name: ride.driver.first_name,
                    last_name: ride.driver.last_name,
                    email: ride.driver.email,
                    rating: ride.driver.rating,
                },
            }

            res.status(200).json({ message: "Ride found", data: response });
        } catch (error) {
            console.log(error);
            res.status(500).json({ message: "Internal server error" });
        }
    },

    editProfile: async (req: Request, res: Response) => {
        try {
            const userId = res.locals.userId;
            if (!userId) {
                res.status(400).json({ message: "User not authenticated" });
                return;
            }
            const user: IUser = res.locals.user;

            const { first_name, last_name } = req.body;

            if (first_name) {
                user.first_name = first_name;
            }
            if (last_name) {
                user.last_name = last_name;
            }
            if (req.file) {
                user.avatar = req.file.path;
            }

            if (!first_name && !last_name && !req.file) {
                res.status(400).json({ message: "At least one field is required" });
                return;
            }

            await user.save();
            res.status(200).json({ message: "Profile updated successfully" });

        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Internal server error" });
        }
    },

    registerVehicle: async (req: Request, res: Response) => {
        try {
            if (!req.body) {
                res.status(400).json({ message: "Invalid Request" });
                return;
            }
            const { vehicleRegNumber, carColor, vehicleModel, seat, licensePlate, vehicleYear } = req.body;
            if (!vehicleRegNumber || !carColor || !vehicleModel || !seat || !licensePlate || !vehicleYear) {
                res.status(400).json({ message: "Invalid Request" });
                return;
            }

            const user = res.locals.user;
            if (!user) {
                res.status(400).json({ message: "User not found" });
                return;
            }

            user.driverProfile.vehicleRegNumber = vehicleRegNumber;
            user.driverProfile.carColor = carColor;
            user.driverProfile.vehicleModel = vehicleModel;
            user.driverProfile.seat = seat;
            user.driverProfile.licensePlate = licensePlate;
            user.driverProfile.vehicleYear = vehicleYear;

            await user.save();

            res.status(200).json({ message: "Vehicle-Registered" });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Internal server error" });
        }
    },

    uploadVehicleDocs: async (req: Request, res: Response) => {
        try {
            if (!req.files) {
                return res.status(400).json({ message: "All documents are required" });
            }

            const user = res.locals.user;
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            const uploadedDocs: { name: string; url: string }[] = [];

            Object.entries(req.files).forEach(([key, files]) => {
                (files as Express.Multer.File[]).forEach((file) => {
                    uploadedDocs.push({ name: key, url: file.path });
                });
            });

            user.driverProfile.documents.push(...uploadedDocs);
            await user.save();

            return res.status(200).json({ message: "Documents uploaded successfully" });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Internal Server Error" });
        }
    },

    getTodayRideSummary: async (req: Request, res: Response) => {
        try {
            const user = res.locals.user;
            if (!user) {
                res.status(404).json({ message: "User not found" });
                return;
            }
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const rides = await Ride.find({
                user: user._id,
                status: "completed",
                requested_at: {
                    $gte: today,
                    $lt: tomorrow,
                },
            });

            let totalEarnings = 0;
            let totalRides = 0;
            rides.forEach((ride) => {
                totalEarnings += ride.fare;
                totalRides++;
            });

            res.status(200).json({
                message: "Today's ride summary",
                data: {
                    totalEarnings,
                    totalRides,
                }
            })

        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Internal Server Error" });
        }

    },

    getAllRideRequest: async (req: Request, res: Response) => {
        try {
            const user = res.locals.user;
            if (!user) {
                res.status(404).json({ message: "User not found" });
                return;
            }

            const rides = await Ride.find({
                user: user._id,
                status: "pending",
            }).populate<{ rider: IUser }>("rider", "avatar first_name last_name rating");

            const response = rides.map((ride) => ({
                rideId: ride._id,
                avatar: ride.rider.avatar,
                first_name: ride.rider.first_name,
                last_name: ride.rider.last_name,
                rating: ride.rider.rating,
                pickup_location: ride.pickup_location,
                dropoff_location: ride.dropoff_location,
                requested_at: ride.requested_at,
            }));

            res.status(200).json({
                message: "All ride requests",
                data: response,
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Internal Server Error" });
        }
    },

    acceptRide: async (req: Request, res: Response) => {
        try {
            const { rideId } = req.body;
            if (!rideId) {
                res.status(400).json({ message: "Invalid Request" });
                return;
            }
            const ride = await Ride.findById(rideId);
            if (!ride) {
                res.status(404).json({ message: "Ride not found" });
                return;
            }
            if (ride.status !== "pending") {
                res.status(400).json({ message: "Ride is not pending" });
                return;
            }
            if (ride.driver.toString() !== res.locals.user._id.toString()) {
                res.status(400).json({ message: "You are not authorized to accept this ride" });
                return;
            }

            ride.status = "accepted";
            await ride.save();
            res.status(200).json({ message: "Ride accepted" });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Internal Server Error" });
        }
    },

    declineRide: async (req: Request, res: Response) => {
        try {
            const { rideId } = req.body;
            if (!rideId) {
                res.status(400).json({ message: "Invalid Request" });
                return;
            }
            const ride = await Ride.findById(rideId);
            if (!ride) {
                res.status(404).json({ message: "Ride not found" });
                return;
            }
            if (ride.status !== "pending") {
                res.status(400).json({ message: "Ride is not pending" });
                return;
            }
            if (ride.driver.toString() !== res.locals.user._id.toString()) {
                res.status(400).json({ message: "You are not authorized to decline this ride" });
                return;
            }
            ride.status = "rejected";
            await ride.save();
            res.status(200).json({ message: "Ride declined" });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Internal server error" });
        }
    },

};