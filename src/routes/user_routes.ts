import express from "express";
import { userController } from "../controllers/user_controller";
import { uploadProfile, uploadMore } from "../middlewares/upload";
import tokenValidationMiddleware from "../middlewares/token_validator";
import { statusChecker } from "../middlewares/status_middleware";
import roleMiddleware from "../middlewares/role_middleware";

const router = express.Router();

router.use(tokenValidationMiddleware);

router.patch("/upload-vehicle-docs", roleMiddleware("driver"), uploadMore.fields([
    { name: "driver_license", maxCount: 1 },
    { name: "vehicle_license", maxCount: 1 },
    { name: "vehicle_insurance", maxCount: 1 },
    { name: "mot_certificate", maxCount: 1 },
]), userController.uploadVehicleDocs);

router.post("/upload-profile", uploadProfile.single("avatar"), userController.uploadProfile);
router.get("/get-address", userController.getUserAddress);
router.post("/save-address", userController.saveAddress);
router.get("/get-user-details", userController.getUserDetails);
router.post("/update-location", userController.updateLocation);
router.post("/save-signal-id/:id", userController.saveSignalId);
router.post("/register-vehicle", userController.registerVehicle);

router.use(statusChecker);

router.post("/find-nearby-drivers", userController.findNearByDrivers);
router.get("/get-all-ride-request", userController.getAllRideRequest);
router.get("/get-current-ride", userController.getCurrentRide);
router.get("/get-ride-history", userController.getRideHistory);
router.get("/get-rating", userController.getAllRatings);
router.post("/rate-driver", userController.rateTrip);
router.get("/get-ride/:rideId", userController.getRideById);
router.post("/accept-ride", userController.acceptRide);
router.post("/decline-ride", userController.declineRide);
router.post("/cancel-ride", userController.cancelRide);
router.post("/start-ride", userController.startRide);

router.get("/get-driver-ride-stat", userController.getDriverRideStat);
router.post("/edit-profile", uploadProfile.single("avatar"), userController.editProfile);
router.get("/get-today-ride-summary", userController.getTodayRideSummary);
router.post("/update-availability-status", userController.updateavailabilityStatus);





export default router;
