import { Request, Response } from "express";
import User from "../models/user_model";
import Ride from "../models/ride_model";
import { IUser } from "../types/user_type";
import Rating from "../models/rating_model";
import { io } from "../config/socket";
import sendPushNotification from "../config/onesignal";
import getCoordinatesFromAddress from "../utils/get_coordinates_from_address";
import { getETAFromLocationIQ } from "../utils/get_eta_from_coordinates";
import Notification from "../models/notification_model";

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
        _id: user._id,
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
        payment_fine: user.payment_fine,
        location: {
          lat: user.location?.coordinates[1],
          lng: user.location?.coordinates[0],
          address: user.location?.address,
        },
        driverProfile: {
          ...user.driverProfile,
          documents: undefined,
        },
        createdAt: user.createdAt,
        rating: user.rating.avg,
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
      res.status(200).json({ data: user.address });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  saveAddress: async (req: Request, res: Response) => {
    try {
      const { address } = req.body;

      if (!address) {
        return res
          .status(400)
          .json({ message: "At least one address is required" });
      }

      for (const addr of address) {
        if (!addr.type || !addr.address) {
          return res.status(400).json({
            message: "Each address must include type, address, and coordinates",
          });
        }
      }

      const userId = res.locals.userId;
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const alreadySaved = user.address.map((addr) => ({
        type: addr.type.trim().toLowerCase(),
        address: addr.address.trim().toLowerCase(),
      }));

      const duplicate = address.find(
        (addr: { type: string; address: string }) => {
          const normalized = {
            type: addr.type.trim().toLowerCase(),
            address: addr.address.trim().toLowerCase(),
          };
          return alreadySaved.some(
            (saved) =>
              saved.type === normalized.type ||
              saved.address === normalized.address
          );
        }
      );

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
          addr.coordinates = [coords.lng, coords.lat];
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
      if (!req.body) {
        res.status(400).json({ message: "invalid request" });
        return;
      }

      const {
        carSeat,
        pickupLocation,
        dropoffLocation,
        wheelChairAccessible,
        stops,
      } = req.body;

      // === Validate request ===
      if (!carSeat || !pickupLocation || !dropoffLocation) {
        return res.status(400).json({ message: "All fields are required" });
      }

      if (
        typeof pickupLocation.lat !== "number" ||
        typeof pickupLocation.lng !== "number" ||
        !pickupLocation.address
      ) {
        return res.status(400).json({ message: "Invalid pickup location" });
      }

      if (
        typeof dropoffLocation.lat !== "number" ||
        typeof dropoffLocation.lng !== "number" ||
        !dropoffLocation.address
      ) {
        return res.status(400).json({ message: "Invalid dropoff location" });
      }

      if (stops) {
        for (const stop of stops) {
          if (!stop.lat || !stop.lng || !stop.address) {
            return res.status(400).json({ message: "Invalid stops" });
          }
        }
      }

      const user = res.locals.user;
      if (user.payment_fine > 0) {
        return res.status(408).json({ message: "You have a payment fine" });
      }

      // === Check for existing pending ride ===
      let currentRide = await Ride.findOne({
        rider: res.locals.userId,
        status: "pending",
      });

      const declinedDrivers = currentRide?.excluded_drivers || [];

      // === Build base query ===
      const driverQuery: any = {
        _id: { $nin: declinedDrivers },
        role: "driver",
        account_status: "active",
        availability_status: "online",
        "driverProfile.carSeat": { $gte: carSeat },
        location: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [pickupLocation.lng, pickupLocation.lat],
            },
            $maxDistance: 10000, // 10 km
          },
        },
      };

      // === Add wheelchair filter only if provided ===
      if (wheelChairAccessible === true) {
        driverQuery["driverProfile.wheelChairAccessible"] =
          wheelChairAccessible;
      }

      const closestDrivers = await User.find(driverQuery)
        .limit(10)
        .select(
          "driverProfile avatar first_name last_name email rating location"
        );

      if (!closestDrivers.length) {
        return res.status(404).json({ message: "No drivers found nearby" });
      }

      // === Create or update ride ===
      if (!currentRide) {
        currentRide = new Ride({
          rider: res.locals.userId,
          status: "pending",
          pickup_location: pickupLocation,
          dropoff_location: dropoffLocation,
          fare: 0,
          requested_at: new Date(),
          payment_status: "pending",
          amount_paid: 0,
          rated_by_rider: false,
          rated_by_driver: false,
          excluded_drivers: [],
          driver: null,
          invited_drivers: closestDrivers.map((d) => d._id), // NEW FIELD
        });
        await currentRide.save();
      } else {
        await Ride.findByIdAndUpdate(currentRide._id, {
          invited_drivers: closestDrivers.map((d) => d._id),
        });
      }

      // === Notify all invited drivers ===
      closestDrivers.forEach((driver) => {
        io.to(driver._id.toString()).emit("ride-request", {
          rideId: currentRide!._id,
          pickup: pickupLocation,
          dropoff: dropoffLocation,
        });
      });

      // === Respond to rider ===
      res.status(200).json({
        message: "Ride request sent to nearby drivers",
        data: {
          ride: currentRide,
          invited_drivers: closestDrivers,
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
      const role = res.locals.role;
      if (!userId) {
        res.status(400).json({ message: "User not authenticated" });
        return;
      }
      let key = "";
      if (role === "rider") {
        key = "rated_by_rider";
      } else {
        key = "rated_by_driver";
      }
      const ride = await Ride.findOne({
        [role]: userId,
        $or: [
          {
            status: {
              $in: [
                "pending",
                "accepted",
                "arrived",
                "progress",
                "paused",
                "panic",
              ],
            },
          },
          { status: "completed", [key]: false },
        ],
      })
        .populate<{ rider: IUser }>("rider")
        .sort({ requested_at: -1 });

      if (!ride) {
        res.status(404).json({ message: "No ride found" });
        return;
      }

      let etaData: any = {};

      const driver = await User.findById(ride.driver);
      if (driver) {
        etaData = await getETAFromLocationIQ(
          driver!.location!.coordinates as [number, number],
          ride.pickup_location
        );
      }

      const rideObj: any = ride.toObject();

      rideObj.riderProfile = {
        id: ride.rider._id,
        first_name: ride.rider.first_name,
        last_name: ride.rider.last_name,
        avatar: ride.rider.avatar,
      };
      rideObj.rider = ride.rider._id;

      rideObj.eta = etaData
        ? {
            minutes: Math.ceil(etaData.duration / 60),
            distance_km: (etaData.distance / 1000).toFixed(2),
          }
        : null;

      res.status(200).json({
        message: "Ride found",
        data: {
          ride: rideObj,
          driver: driver ?? null,
          eta: etaData
            ? {
                minutes: Math.ceil(etaData.duration / 60),
                distance_km: (etaData.distance / 1000).toFixed(2),
              }
            : null,
        },
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  rateTrip: async (req: Request, res: Response) => {
    try {
      let { rating, comment, rideId } = req.body;
      const user = res.locals.user;
      rating = Number(rating);

      if (!user) {
        return res.status(400).json({ message: "User not authenticated" });
      }

      if (!rideId || !rating) {
        return res.status(400).json({ message: "All fields are required" });
      }

      if (rating < 1 || rating > 5) {
        return res
          .status(400)
          .json({ message: "Rating must be between 1 and 5" });
      }

      const ride = await Ride.findById(rideId);

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

      // Figure out who is being rated
      const personToRateId = user.role === "rider" ? ride.driver : ride.rider;

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
      let ratingDoc = await Rating.findOne({ rideId });

      if (!ratingDoc) {
        ratingDoc = new Rating({
          rideId,
          rider: ride.rider,
          driver: ride.driver,
        });
      }

      if (user.role === "rider") {
        ratingDoc.riderRating = rating;
        ratingDoc.riderComment = comment;
        ride.rated_by_rider = true;
      } else {
        ratingDoc.driverRating = rating;
        ratingDoc.driverComment = comment;
        ride.rated_by_driver = true;
      }

      await ratingDoc.save();
      await ride.save();

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
      const { pageNum = 1, limitNum = 20, status, timeRange } = req.query;

      const page = Number(pageNum);
      const limit = Number(limitNum);
      const skip = (page - 1) * limit;

      const userId = res.locals.userId;
      if (!userId) {
        res.status(400).json({ message: "User not authenticated" });
        return;
      }
      let statusQuery = {};
      if (status && status !== null && status !== "all") {
        statusQuery = { status };
      }
      let timeQuery = {};
      if (timeRange && timeRange !== "all time") {
        const now = new Date();
        let startDate = new Date();

        switch (timeRange) {
          case "last 30 days":
            startDate.setDate(now.getDate() - 30);
            break;
          case "last 3 months":
            startDate.setMonth(now.getMonth() - 3);
            break;
          case "this year":
            startDate = new Date(now.getFullYear(), 0, 1); // January 1st of current year
            break;
          default:
            break;
        }

        timeQuery = { requested_at: { $gte: startDate } };
      }

      const rides = await Ride.find({
        $or: [{ rider: userId }, { driver: userId }],
        ...statusQuery,
        ...timeQuery,
      })
        .populate<{ driver: IUser }>(
          "driver",
          "driverProfile avatar first_name last_name email rating"
        )
        .populate<{ rider: IUser }>(
          "rider",
          "avatar first_name last_name email"
        )
        .sort({ requested_at: -1 })
        .skip(skip)
        .limit(limit);
      if (!rides) {
        res.status(404).json({ message: "No ride history found" });
        return;
      }

      const response = await Promise.all(
        rides.map(async (ride) => {
          const rating = await Rating.findOne({ rideId: ride._id });
          return {
            _id: ride._id,
            status: ride.status,
            pickup_location: ride.pickup_location,
            dropoff_location: ride.dropoff_location,
            fare: ride.fare,
            amount_paid: ride.amount_paid,
            rated_by_rider: ride.rated_by_rider,
            rated_by_driver: ride.rated_by_driver,
            driverProfile: ride.driver
              ? {
                  first_name: ride.driver.first_name,
                  last_name: ride.driver.last_name,
                  avatar: ride.driver.avatar,
                }
              : null,
            riderProfile: ride.rider
              ? {
                  first_name: ride.rider.first_name,
                  last_name: ride.rider.last_name,
                  avatar: ride.rider.avatar,
                }
              : null,
            requested_at: ride.requested_at,
            rating:
              res.locals.role === "rider"
                ? rating?.driverRating
                : rating?.riderRating,
            comment:
              res.locals.role === "rider"
                ? rating?.driverComment
                : rating?.riderComment,
          };
        })
      );

      res.status(200).json({
        message: "Ride history found",
        data: response,
        pagination: {
          page,
          limit,
          total: rides.length,
          totalPages: Math.ceil(rides.length / limit),
          hasNextPage: page < Math.ceil(rides.length / limit),
          hasPrevPage: page > 1,
        },
      });
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

      const { first_name, last_name, email, phone } = req.body;

      if (!first_name && !last_name && !req.file && !email && !phone) {
        res.status(400).json({ message: "At least one field is required" });
        return;
      }

      if (first_name) {
        user.first_name = first_name;
      }
      if (last_name) {
        user.last_name = last_name;
      }
      if (req.file) {
        user.avatar = req.file.path;
      }
      if (email) {
        user.email = email;
      }
      if (phone) {
        user.phone = phone;
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
        licensePlate,
        vehicleYear,
      } = req.body;

      if (
        !vehicleRegNumber ||
        !carColor ||
        !vehicleModel ||
        !licensePlate ||
        !vehicleYear
      ) {
        res.status(400).json({ message: "Invalid Request" });
        return;
      }

      const userId = res.locals.userId;
      if (!userId) {
        res.status(400).json({ message: "User not found" });
        return;
      }

      const user = await User.findById(userId);
      if (!user) {
        res.status(400).json({ message: "User not found" });
        return;
      }

      user.driverProfile.vehicleRegNumber = vehicleRegNumber;
      user.driverProfile.carColor = carColor;
      user.driverProfile.carModel = vehicleModel;
      user.driverProfile.carPlate = licensePlate;
      user.driverProfile.vehicleYear = vehicleYear;

      await user.save();

      res.status(200).json({ message: "Vehicle-Registered" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  registerCarType: async (req: Request, res: Response) => {
    try {
      if (!req.body) {
        res.status(400).json({ message: "Invalid Request" });
        return;
      }
      const { seats, wheelChairAccessible } = req.body;
      if (!seats || wheelChairAccessible === undefined) {
        res.status(400).json({ message: "Invalid Request" });
        return;
      }
      const userId = res.locals.userId;
      if (!userId) {
        res.status(400).json({ message: "User not found" });
        return;
      }
      const user = await User.findById(userId);
      if (!user) {
        res.status(400).json({ message: "User not found" });
        return;
      }
      user.driverProfile.carSeat = seats;
      user.driverProfile.wheelChairAccessible = wheelChairAccessible;
      await user.save();
      res.status(200).json({ message: "Car Type Registered" });
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

      const userId = res.locals.userId;
      if (!userId) {
        return res.status(404).json({ message: "User not found" });
      }

      const user = await User.findById(userId);
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
      user.driverProfile.isProfileCompleted = true;

      //TODO: To be removed once admin panel is created
      user.driverProfile.isVerified = true;
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
      const { pageNum = 1, limitNum = 20 } = req.query;
      const page = Number(pageNum);
      const limit = Number(limitNum);
      const skip = (page - 1) * limit;

      const user = res.locals.user;
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }
      const query = {
        $or: [{ rider: user._id }, { driver: user._id }],
      };
      const ratings = await Rating.find(query)
        .populate<{ rider: IUser }>("rider", "first_name last_name avatar")
        .populate<{ driver: IUser }>("driver", "first_name last_name avatar")
        .skip(skip)
        .limit(limit);

      if (!ratings) {
        res.status(404).json({ message: "No ratings found" });
        return;
      }

      const response = ratings.map((rating) => ({
        id: rating._id,
        rider: {
          avatar: rating.rider.avatar,
          first_name: rating.rider.first_name,
          last_name: rating.rider.last_name,
        },
        driver: {
          avatar: rating.driver.avatar,
          first_name: rating.driver.first_name,
          last_name: rating.driver.last_name,
        },
        riderRating: rating.riderRating,
        riderComment: rating.riderComment,

        driverRating: rating.driverRating,
        driverComment: rating.driverComment,
        createdAt: rating.createdAt,
      }));

      res.status(200).json({
        message: "Ratings found",
        data: response,
        pagination: {
          page,
          limit,
          total: ratings.length,
          totalPages: Math.ceil(ratings.length / limit),
          hasNextPage: page < Math.ceil(ratings.length / limit),
          hasPrevPage: page > 1,
        },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },

  getTodayRideSummary: async (req: Request, res: Response) => {
    try {
      const user = res.locals.user;
      const role = res.locals.role;
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      let key = role === "driver" ? "driver" : "rider";
      const rides = await Ride.find({
        [key]: user._id,
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
      const driverId = res.locals.userId; // logged-in driver
      const { rideId } = req.body;

      if (!rideId) {
        return res.status(400).json({ message: "Ride ID is required" });
      }

      // Atomic check: only accept if still pending & no driver yet
      const ride = await Ride.findOneAndUpdate(
        {
          _id: rideId,
          status: "pending",
          driver: { $eq: null },
        },
        {
          $set: { driver: driverId, status: "accepted" },
        },
        { new: true }
      ).populate<{ rider: IUser }>("rider");

      // If null → another driver already accepted
      if (!ride) {
        return res.status(400).json({ message: "Ride already taken" });
      }

      // ✅ Verify this driver was actually invited
      if (!ride.invited_drivers?.includes(driverId)) {
        return res
          .status(403)
          .json({ message: "You were not invited to this ride" });
      }

      // === Notify rider
      const rideObj: any = ride.toObject();
      rideObj.rider = ride.rider._id;

      const driver = res.locals.user;

      const etaData = await getETAFromLocationIQ(
        driver.location!.coordinates as [number, number],
        ride.pickup_location
      );

      io.to(ride.rider._id.toString()).emit("tripStatus", {
        message: "Driver has accepted your ride",
        data: {
          ride: rideObj,
          status: ride.status,
          driver: res.locals.user,
          eta: etaData
            ? {
                minutes: Math.ceil(etaData.duration / 60),
                distance_km: (etaData.distance / 1000).toFixed(2),
              }
            : null,
        },
      });

      if (ride.rider.one_signal_id) {
        await sendPushNotification(
          ride.rider.one_signal_id,
          "Your Ride Request has been accepted. Check driver location.",
          ride.rider._id
        );
      }
      rideObj.riderProfile = {
        id: ride.rider._id,
        first_name: ride.rider.first_name,
        last_name: ride.rider.last_name,
        avatar: ride.rider.avatar,
      };

      rideObj.eta = etaData
        ? {
            minutes: Math.ceil(etaData.duration / 60),
            distance_km: (etaData.distance / 1000).toFixed(2),
          }
        : null;

      res
        .status(200)
        .json({ message: "Ride accepted successfully", data: rideObj });

      // === Notify other invited drivers they lost
      ride.invited_drivers.forEach((d: any) => {
        if (d.toString() !== driverId.toString()) {
          io.to(d.toString()).emit("ride-rejected", {
            rideId: ride._id,
            message: "Another driver accepted the ride",
          });
        }
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },

  arrivedAtPickUpLocation: async (req: Request, res: Response) => {
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
        res.status(400).json({
          message: "You are not authorized to arrive at pick up location",
        });
        return;
      }
      ride.status = "arrived";
      await ride.save();

      const rideObj: any = ride.toObject();

      // Replace populated fields with just their IDs
      rideObj.rider = ride.rider._id;
      rideObj.riderProfile = {
        id: ride.rider._id,
        first_name: ride.rider.first_name,
        last_name: ride.rider.last_name,
        avatar: ride.rider.avatar,
      };

      io.to(ride.rider._id.toString()).emit("tripStatus", {
        message: "Driver has arrived at pick up location",
        data: {
          ride: rideObj,
          // driver: res.locals.user,
          status: ride.status,
        },
      });
      if (ride.rider.one_signal_id != null) {
        await sendPushNotification(
          ride.rider.one_signal_id,
          "Your Ride Request has been accepted, check driver location",
          ride.rider._id
        );
      }
      res
        .status(200)
        .json({ message: "Arrived at pick up location", data: rideObj });
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
      if (!ride.invited_drivers?.includes(driver._id.toString())) {
        res
          .status(400)
          .json({ message: "You are not authorized to decline this ride" });
        return;
      }
      ride.excluded_drivers = [...(ride.excluded_drivers || []), driver._id];
      ride.invited_drivers = ride.invited_drivers.filter(
        (id) => id.toString() !== driver._id.toString()
      );

      await ride.save();

      res.status(200).json({ message: "Ride declined successfully" });
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
      if (ride.status !== "accepted" && ride.status !== "arrived") {
        res.status(400).json({ message: "Ride is not accepted or arrived" });
        return;
      }

      if (
        ride.rider._id.toString() !== res.locals.user._id.toString() &&
        ride.driver._id.toString() !== res.locals.user._id.toString()
      ) {
        res
          .status(400)
          .json({ message: "You are not authorized to cancel this ride" });
        return;
      }
      ride.status = "cancelled";
      ride.driver.availability_status = "online";
      if (res.locals.role === "rider") {
        ride.rider.payment_fine += 3;
      }
      await ride.save();
      await ride.rider.save();
      res.status(200).json({ message: "Ride cancelled" });

      const rideObj: any = ride.toObject();
      rideObj.rider = ride.rider._id;
      rideObj.driver = ride.driver._id;

      io.to(rideObj.rider.toString()).emit("tripStatus", {
        message: `The ${user.role} has cancelled the ride.`,
        rideId: ride._id,
        data: {
          ride: rideObj,
          status: "cancelled",
        },
      });

      io.to(rideObj.driver.toString()).emit("tripStatus", {
        message: `The ${user.role} has cancelled the ride.`,
        rideId: ride._id,
        data: {
          ride: rideObj,
          status: "cancelled",
        },
      });

      let notifyOtherPartySignalId: any;
      let notifyOtherPartyUserId: any;
      if (ride.rider.toString() === user._id.toString()) {
        notifyOtherPartySignalId = ride.driver.one_signal_id;
        notifyOtherPartyUserId = ride.driver._id;
      } else {
        notifyOtherPartySignalId = ride.rider.one_signal_id;
        notifyOtherPartyUserId = ride.rider._id;
      }
      await sendPushNotification(
        notifyOtherPartySignalId,
        "The passenger has cancelled the ride request.",
        notifyOtherPartyUserId
      );
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  cancelRideRequest: async (req: Request, res: Response) => {
    try {
      const { rideId } = req.body;
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
      if (ride.status !== "pending") {
        res.status(400).json({ message: "Ride is not pending" });
        return;
      }

      if (res.locals.role === "driver") {
        ride.excluded_drivers?.push(res.locals.userId);
      }
      if (res.locals.role === "rider") {
        ride.status = "cancelled";
      }
      await ride.save();

      res.status(200).json({ message: "Ride cancelled" });
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
      if (ride.status !== "arrived") {
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
        address: ride.pickup_location.address,
        coordinates: [ride.pickup_location.lng, ride.pickup_location.lat],
      };
      await driver.save();
      await ride.save();

      res.status(200).json({ message: "Ride started" });

      const rideObj: any = ride.toObject();
      rideObj.rider = ride.rider._id;

      io.to(ride.rider._id.toString()).emit("tripStatus", {
        message: "Driver has started the ride",
        data: {
          ride: rideObj,
          status: ride.status,
          driver: {
            avatar: driver.avatar,
            first_name: driver.first_name,
            last_name: driver.last_name,
          },
        },
      });

      await sendPushNotification(
        ride.rider.one_signal_id,
        "Driver has started the ride",
        ride.rider._id
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
      const user = res.locals.user;
      user.availability_status = "online";
      user.location = {
        type: "Point",
        address: ride.dropoff_location.address,
        coordinates: [ride.dropoff_location.lng, ride.dropoff_location.lat],
      };

      user.driverProfile.allTrips += 1;
      await ride.save();
      await user.save();

      const rideObj: any = ride.toObject();
      rideObj.riderProfile = {
        id: ride.rider._id,
        first_name: ride.rider.first_name,
        last_name: ride.rider.last_name,
        avatar: ride.rider.avatar,
      };
      rideObj.rider = ride.rider._id;
      res.status(200).json({ message: "Ride completed", data: rideObj });

      io.to(ride.rider._id.toString()).emit("tripStatus", {
        message: "Driver has completed the ride",
        data: {
          ride: rideObj,
          status: ride.status,
        },
      });

      await sendPushNotification(
        ride.rider.one_signal_id,
        "Driver has completed the ride",
        ride.rider._id
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

      const acceptanceRatePercentage = Math.trunc(
        (acceptanceRate / allTripCounts) * 100
      );
      const cancellationRatePercentage = Math.trunc(
        (cancellationRate / allTripCounts) * 100
      );

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
      const { lat, lng, address } = req.body;
      if (!lat || !lng || !address) {
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
        address,
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

  updateavailabilityStatus: async (req: Request, res: Response) => {
    try {
      const user = res.locals.user;
      if (!user) {
        res.status(400).json({ message: "User not found" });
        return;
      }
      const { status } = req.body;
      if (!status) {
        res.status(400).json({ message: "Invalid Request" });
        return;
      }

      const ride = await Ride.findOne({
        driver: user._id,
        $or: [
          {
            status: {
              $in: [
                "pending",
                "accepted",
                "arrived",
                "progress",
                "paused",
                "panic",
              ],
            },
          },
          { status: "completed", rated_by_rider: false },
        ],
      }).sort({ requested_at: -1 });

      if (ride) {
        res.status(400).json({ message: "You have an active ride" });
        return;
      }

      user.availability_status = status;
      await user.save();
      res
        .status(200)
        .json({ message: "Availability status updated successfully" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  getUserStatus: async (req: Request, res: Response) => {
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

      if (user.role === "rider" && user.payment_fine > 0) {
        res.status(405).send({ message: "You have a payment fine" });
        return;
      }

      res.status(200).json({
        message: "User status retrieved",
        data: {
          email: user.email,
          status: user.account_status,
          is_email_verified: user.isEmailVerified,
          is_phone_number_verified: user.isPhoneVerified,
          profile_completed: user.driverProfile.isProfileCompleted,
          role: user.role,
        },
      });
    } catch (error) {
      console.error("Error retrieving user status:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },

  driverRideRequests: async (req: Request, res: Response) => {
    try {
      const driverId = res.locals.userId;
      const driver = res.locals.user;

      if (!driver) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      const rides = await Ride.find({
        invited_drivers: { $in: [driverId] },
        status: "pending",
        driver: null,
      }).populate<{ rider: IUser }>("rider");

      // const etaData = await getETAFromLocationIQ(
      //   driver.location!.coordinates as [number, number],
      //   ride.pickup_location
      // );

      const response = await Promise.all(
        rides.map(async (ride) => {
          const etaData = await getETAFromLocationIQ(
            driver.location!.coordinates as [number, number],
            ride.pickup_location
          );
          return {
            _id: ride._id,
            status: ride.status,
            pickup_location: ride.pickup_location,
            dropoff_location: ride.dropoff_location,
            riderProfile: ride.rider
              ? {
                  id: ride.rider._id,
                  first_name: ride.rider.first_name,
                  last_name: ride.rider.last_name,
                  avatar: ride.rider.avatar,
                }
              : null,
            requested_at: ride.requested_at,
            eta: etaData
              ? {
                  minutes: Math.ceil(etaData.duration / 60),
                  distance_km: (etaData.distance / 1000).toFixed(2),
                }
              : null,
          };
        })
      );

      res
        .status(200)
        .json({ message: "Ride requests retrieved", data: response });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  markNotification: async (req: Request, res: Response) => {
    try {
      const userId = res.locals.userId;
      const notificationId = req.params.id;

      if (!userId || !notificationId) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      await Notification.updateOne(
        { userId, _id: notificationId },
        { read: true }
      );

      res.status(200).json({ message: "Notification marked as read" });
    } catch (err) {
      console.error("Error in markNotification:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  markNotificationById: async (req: Request, res: Response) => {
    try {
      const userId = res.locals.userId;
      const notificationId = req.params.id;

      if (!userId || !notificationId) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      await Notification.updateOne(
        { userId, _id: notificationId },
        { read: true }
      );

      res.status(200).json({ message: "Notification marked as read" });
    } catch (err) {
      console.error("Error in markNotificationById:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  getAllNotifications: async (req: Request, res: Response) => {
    try {
      const userId = res.locals.userId;

      if (!userId) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      const notifications = await Notification.find({ userId });

      res.status(200).json({
        message: "Notifications retrieved",
        data: notifications,
      });
    } catch (err) {
      console.error("Error in getAllNotifications:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  call: async (req: Request, res: Response) => {
    try {

      const user = res.locals.user;
      if (!user) {
        res.status(400).json({ message: "User not found" });
        return;
      }
      if (!req.body) {
        res.status(400).json({ message: "Bad request" });
        return;
      }
      const { tripId } = req.body;
      if (!tripId) {
        res.status(400).json({ message: "Trip ID is required" });
        return;
      }

      // Find the trip and populate both driver and rider information
      const trip = await Ride.findById(tripId)
        .populate<{ driver: IUser }>("driver")
        .populate<{ rider: IUser }>("rider");

      if (!trip) {
        res.status(404).json({ message: "Trip not found" });
        return;
      }

      // Determine who is calling and who should receive the call
      let recipient: IUser | null = null;
      let notificationTitle = "";

      if (user.role === "driver") {
        // Driver is calling the rider
        recipient = trip.rider as IUser;
        notificationTitle = "Incoming call from your driver";
      } else {
        // Rider is calling the driver
        recipient = trip.driver as IUser;
        notificationTitle = "Incoming call from your passenger";
      }
      // console.log("recipient", recipient);

      if (!recipient?.one_signal_id) {
        return res
          .status(400)
          .json({ message: "Recipient is not available for calls" });
      }

      // Send push notification to the recipient
      await sendPushNotification(
        recipient.one_signal_id,
        notificationTitle,
        recipient._id,
        {
          type: "call",
          tripId: tripId,
          callerId: user._id,
          callerName: `${user.first_name} ${user.last_name}`,
          callerRole: user.role,
          notificationType: 'call'
        },
        [
          { id: "accept", text: "Accept" },
          { id: "decline", text: "Decline" },
        ],
        60,
        10,
      );

      res.status(200).json({
        message: "Call initiated successfully",
        recipientId: recipient._id,
      });
    } catch (error) {
      console.error("Error in call function:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },
};
