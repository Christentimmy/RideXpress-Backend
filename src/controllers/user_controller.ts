import { Request, Response } from "express";
import User from "../models/user_model";
import Ride from "../models/ride_model";
import { IUser } from "../types/user_type";
import Rating from "../models/rating_model";
import { io } from "../config/socket";
import sendPushNotification from "../config/onesignal";
import getCoordinatesFromAddress from "../utils/get_coordinates_from_address";

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
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
        avatar: user.avatar,
        address: user.address,
        driverProfile: user.driverProfile,
      };

      res
        .status(200)
        .json({ message: "User-Details-Fetched", data: userDetails });
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
      console.log(`Address: ${address}`);

      if (!Array.isArray(address) || address.length === 0) {
        return res
          .status(400)
          .json({ message: "At least one address is required" });
      }

      for (const addr of address) {
        if (!addr.name || !addr.address) {
          return res.status(400).json({
            message: "Each address must include name, address, and coordinates",
          });
        }
      }

      const userId = res.locals.userId;
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const alreadySaved = user.address.map((addr) => ({
        name: addr.name.trim().toLowerCase(),
        address: addr.address.trim().toLowerCase(),
      }));

      const duplicate = address.find((addr) => {
        const normalized = {
          name: addr.name.trim().toLowerCase(),
          address: addr.address.trim().toLowerCase(),
        };
        return alreadySaved.some(
          (saved) =>
            saved.name === normalized.name ||
            saved.address === normalized.address
        );
      });

      if (duplicate) {
        return res.status(409).json({ message: "Duplicate address detected" });
      }

      //generate coordinates for the incoming address
      for (const addr of address) {
        if (!addr.coordinates) {
          const coords = await getCoordinatesFromAddress(addr.address);
          if (!coords) {
            return res
              .status(400)
              .json({ message: "Invalid address provided: " + addr.address });
          }
          addr.coordinates = coords;
        }
      }

      user.address.push(...address);
      await user.save();

      res.status(200).json({ message: "Address saved successfully" });
    } catch (error) {
      console.error(error);
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
              type: "Point",
              coordinates: fromLocation,
            },
            $maxDistance: 10000, // 10 km
          },
        },
      })
        .select("driverProfile avatar first_name last_name email rating ")
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
        },
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
          {
            status: {
              $in: ["pending", "accepted", "progress", "paused", "panic"],
            },
          },
          { status: "ended", payment_status: { $ne: "paid" } },
        ],
      })
        .populate(
          "driver",
          "driverProfile avatar first_name last_name email rating"
        )
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

  rateTrip: async (req: Request, res: Response) => {
    try {
      const { driverId, rating, comment } = req.body;
      const user = res.locals.user;

      if (!user) {
        return res.status(400).json({ message: "User not authenticated" });
      }

      if (!driverId || !rating) {
        return res.status(400).json({ message: "All fields are required" });
      }

      if (rating < 1 || rating > 5) {
        return res
          .status(400)
          .json({ message: "Rating must be between 1 and 5" });
      }

      // Find the completed & paid ride that involves both parties
      const ride = await Ride.findOne({
        rider: user.role === "rider" ? user._id : driverId,
        driver: user.role === "driver" ? user._id : driverId,
        status: "completed",
        payment_status: "paid",
      });

      if (!ride) {
        return res.status(400).json({ message: "Ride not found" });
      }

      // Prevent duplicate ratings based on role
      if (user.role === "rider" && ride.rated_by_rider) {
        return res
          .status(400)
          .json({ message: "You have already rated this driver" });
      }
      if (user.role === "driver" && ride.rated_by_driver) {
        return res
          .status(400)
          .json({ message: "You have already rated this rider" });
      }

      // Mark as rated based on role
      if (user.role === "rider") {
        ride.rated_by_rider = true;
      } else {
        ride.rated_by_driver = true;
      }
      await ride.save();

      // Figure out who is being rated
      const personToRateId = user.role === "rider" ? driverId : ride.rider;

      const personToRate = await User.findById(personToRateId)
        .select("rating")
        .lean();
      if (!personToRate) {
        return res.status(400).json({ message: "User to be rated not found" });
      }

      const currentTotal = personToRate.rating.total || 0;
      const currentAvg = personToRate.rating.avg || 0;

      const updatedTotal = currentTotal + 1;
      const updatedAvg = (currentAvg * currentTotal + rating) / updatedTotal;

      await User.findByIdAndUpdate(personToRateId, {
        $set: { "rating.avg": Number(updatedAvg.toFixed(1)) },
        $inc: { "rating.total": 1 },
      });

      const rateModel = new Rating({
        user: user.role === "rider" ? user._id : driverId,
        driver: user.role === "driver" ? user._id : driverId,
        rating,
        comment,
      });
      await rateModel.save();

      res.status(200).json({
        message: `${
          user.role === "rider" ? "Driver" : "Rider"
        } rated successfully`,
      });
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
      })
        .populate<{ driver: IUser }>(
          "driver",
          "driverProfile avatar first_name last_name email rating"
        )
        .populate<{ rider: IUser }>(
          "rider",
          "avatar first_name last_name email"
        )
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
          rated_by_rider: ride.rated_by_rider,
          rated_by_driver: ride.rated_by_driver,
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
      const ride = await Ride.findById(rideId).populate<{ driver: IUser }>(
        "driver",
        "driverProfile avatar first_name last_name email rating"
      );

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
        rated_by_rider: ride.rated_by_rider,
        rated_by_driver: ride.rated_by_driver,
        requested_at: ride.requested_at,
        driver: {
          _id: ride.driver._id,
          avatar: ride.driver.avatar,
          first_name: ride.driver.first_name,
          last_name: ride.driver.last_name,
          email: ride.driver.email,
          rating: ride.driver.rating,
        },
      };

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
      const {
        vehicleRegNumber,
        carColor,
        vehicleModel,
        seat,
        licensePlate,
        vehicleYear,
      } = req.body;
      if (
        !vehicleRegNumber ||
        !carColor ||
        !vehicleModel ||
        !seat ||
        !licensePlate ||
        !vehicleYear
      ) {
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

      return res
        .status(200)
        .json({ message: "Documents uploaded successfully" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },

  getAllRatings: async (req: Request, res: Response) => {
    try {
      const user = res.locals.user;
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }
      const query = {
        $or: [{ user: user._id }, { driver: user._id }],
      };
      const ratings = await Rating.find(query)
        .populate<{ user: IUser }>("user", "first_name last_name avatar")
        .populate<{ driver: IUser }>("driver", "first_name last_name avatar");

      if (!ratings) {
        res.status(404).json({ message: "No ratings found" });
        return;
      }

      const response = ratings.map((rating) => ({
        ratingId: rating._id,
        user: {
          avatar: rating.user.avatar,
          first_name: rating.user.first_name,
          last_name: rating.user.last_name,
        },
        driver: {
          avatar: rating.driver.avatar,
          first_name: rating.driver.first_name,
          last_name: rating.driver.last_name,
        },
        rating: rating.rating,
        comment: rating.comment,
        createdAt: rating.createdAt,
      }));

      res.status(200).json({ message: "Ratings found", data: response });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
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
        },
      });
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
      }).populate<{ rider: IUser }>(
        "rider",
        "avatar first_name last_name rating"
      );

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
      const ride = await Ride.findById(rideId).populate<{ driver: IUser }>(
        "driver",
        "avatar first_name last_name"
      );

      if (!ride) {
        res.status(404).json({ message: "Ride not found" });
        return;
      }
      if (ride.status !== "pending") {
        res.status(400).json({ message: "Ride is not pending" });
        return;
      }
      if (ride.driver.toString() !== res.locals.user._id.toString()) {
        res
          .status(400)
          .json({ message: "You are not authorized to accept this ride" });
        return;
      }

      ride.status = "accepted";
      await ride.save();
      res.status(200).json({ message: "Ride accepted" });

      io.to(ride.rider.toString()).emit("tripStatus", {
        message: "Driver has accepted your ride",
        data: {
          ride: ride,
          driver: {
            avatar: ride.driver.avatar,
            first_name: ride.driver.first_name,
            last_name: ride.driver.last_name,
          },
        },
      });
      const rider = await User.findById(ride.rider);
      if (!rider) {
        console.log("Rider-could-not-be-found");
        return;
      }
      await sendPushNotification(
        rider.one_signal_id,
        "Your Ride Request has been accepted, check driver location"
      );
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
      const driver = res.locals.user;
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
        res
          .status(400)
          .json({ message: "You are not authorized to decline this ride" });
        return;
      }
      ride.status = "rejected";
      await ride.save();
      res.status(200).json({ message: "Ride declined" });

      const rider = await User.findById(ride.rider);
      if (!rider) {
        console.log("Rider-could-not-be-found");
        return;
      }

      io.to(ride.rider.toString()).emit("tripStatus", {
        message: "Driver has cancelled the ride request",
        data: {
          ride: ride,
          driver: {
            avatar: driver.avatar,
            first_name: driver.first_name,
            last_name: driver.last_name,
          },
        },
      });
      await sendPushNotification(
        rider.one_signal_id,
        "Your Ride Request has been declined"
      );
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  cancelRide: async (req: Request, res: Response) => {
    try {
      const { rideId } = req.body;
      const user = res.locals.user;
      if (!rideId) {
        res.status(400).json({ message: "Invalid Request" });
        return;
      }
      const ride = await Ride.findById(rideId)
        .populate<{ rider: IUser }>("rider")
        .populate<{ driver: IUser }>("driver");

      if (!ride) {
        res.status(404).json({ message: "Ride not found" });
        return;
      }
      if (ride.status !== "accepted") {
        res.status(400).json({ message: "Ride is not accepted" });
        return;
      }

      if (
        ride.rider.toString() !== res.locals.user._id.toString() &&
        ride.driver.toString() !== res.locals.user._id.toString()
      ) {
        res
          .status(400)
          .json({ message: "You are not authorized to cancel this ride" });
        return;
      }
      ride.status = "cancelled";
      await ride.save();
      res.status(200).json({ message: "Ride cancelled" });

      io.to(ride.driver.toString()).emit("tripStatus", {
        message: `The ${user.role} has cancelled the ride.`,
        rideId: ride._id,
      });

      let notifyOtherPartyId: any;
      if (ride.rider.toString() === user._id.toString()) {
        notifyOtherPartyId = ride.driver.one_signal_id;
      } else {
        notifyOtherPartyId = ride.rider.one_signal_id;
      }
      await sendPushNotification(
        notifyOtherPartyId,
        "The passenger has cancelled the ride request."
      );
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  startRide: async (req: Request, res: Response) => {
    try {
      const { rideId } = req.body;
      if (!rideId) {
        res.status(400).json({ message: "Invalid Request" });
        return;
      }
      const ride = await Ride.findById(rideId).populate<{ rider: IUser }>(
        "rider"
      );
      if (!ride) {
        res.status(404).json({ message: "Ride not found" });
        return;
      }
      if (ride.status !== "accepted") {
        res.status(400).json({ message: "Ride is not accepted" });
        return;
      }
      if (ride.driver.toString() !== res.locals.user._id.toString()) {
        res
          .status(400)
          .json({ message: "You are not authorized to start this ride" });
        return;
      }
      const driver = await User.findById(ride.driver);
      if (!driver) {
        res.status(404).json({ message: "Driver not found" });
        return;
      }
      ride.status = "progress";
      driver.availability_status = "on_trip";
      driver.location = {
        type: "Point",
        coordinates: [ride.pickup_location.lng, ride.pickup_location.lat],
      };

      driver.driverProfile.allTrips += 1;
      await driver.save();

      await ride.save();

      res.status(200).json({ message: "Ride started" });

      io.to(ride.rider.toString()).emit("tripStatus", {
        message: "Driver has started the ride",
        data: {
          ride: ride,
          driver: {
            avatar: driver.avatar,
            first_name: driver.first_name,
            last_name: driver.last_name,
          },
        },
      });

      await sendPushNotification(
        ride.rider.one_signal_id,
        "Driver has started the ride"
      );
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  completeRide: async (req: Request, res: Response) => {
    try {
      const { rideId } = req.body;
      if (!rideId) {
        res.status(400).json({ message: "Invalid Request" });
        return;
      }
      const ride = await Ride.findById(rideId).populate<{ rider: IUser }>(
        "rider"
      );
      if (!ride) {
        res.status(404).json({ message: "Ride not found" });
        return;
      }
      if (ride.status !== "progress") {
        res.status(400).json({ message: "Ride is not in progress" });
        return;
      }
      if (ride.driver.toString() !== res.locals.user._id.toString()) {
        res
          .status(400)
          .json({ message: "You are not authorized to complete this ride" });
        return;
      }
      ride.status = "completed";
      await ride.save();
      res.status(200).json({ message: "Ride completed" });

      io.to(ride.rider.toString()).emit("tripStatus", {
        message: "Driver has completed the ride",
      });

      await sendPushNotification(
        ride.rider.one_signal_id,
        "Driver has completed the ride"
      );
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  getDriverRideStat: async (req: Request, res: Response) => {
    try {
      const user = res.locals.user;
      if (!user) {
        res.status(400).json({ message: "Invalid Request" });
        return;
      }

      const allTripCounts = user.driverProfile.allTrips;
      const acceptanceRate = await Ride.countDocuments({
        driver: user._id,
        status: "completed",
      });
      const cancellationRate = await Ride.countDocuments({
        driver: user._id,
        status: "cancelled",
      });

      const acceptanceRatePercentage = (acceptanceRate / allTripCounts) * 100;
      const cancellationRatePercentage =
        (cancellationRate / allTripCounts) * 100;

      res.status(200).json({
        message: "Driver ride stats",
        data: {
          allTripCounts,
          acceptanceRatePercentage,
          cancellationRatePercentage,
        },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  updateLocation: async (req: Request, res: Response) => {
    try {
      const userId = res.locals.userId;
      if (!userId) {
        res.status(400).json({ message: "Invalid Request" });
        return;
      }
      const { lat, lng } = req.body;
      if (!lat || !lng) {
        res.status(400).json({ message: "Invalid Request" });
        return;
      }
      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }
      user.location = {
        type: "Point",
        coordinates: [lng, lat],
      };
      await user.save();
      res.status(200).json({ message: "Location updated successfully" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  saveSignalId: async (req: Request, res: Response) => {
    try {
      const userId = res.locals.userId;
      if (!userId) {
        res.status(400).json({ message: "Invalid Request" });
        return;
      }
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ message: "Invalid Request" });
        return;
      }
      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }
      user.one_signal_id = id;
      await user.save();
      res.status(200).json({ message: "Signal ID saved successfully" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  },
};
