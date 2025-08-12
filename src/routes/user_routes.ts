import express from "express";
import { userController } from "../controllers/user_controller";
import { uploadProfile, uploadMore } from "../middlewares/upload";
import tokenValidationMiddleware from "../middlewares/token_validator";
import { statusChecker } from "../middlewares/status_middleware";
import roleMiddleware from "../middlewares/role_middleware";

const router = express.Router();

router.use(tokenValidationMiddleware);


router.post("/upload-profile", uploadProfile.single("avatar"), userController.uploadProfile);
router.get("/get-address", userController.getUserAddress);
router.post("/save-address", userController.saveAddress);
router.get("/get-user-details", userController.getUserDetails);


router.use(statusChecker);

router.post("/find-nearby-drivers", userController.findNearByDrivers);
router.get("/get-current-ride", userController.getCurrentRide);
router.post("/rate-driver", userController.rateDriver);
router.get("/get-ride/:rideId", userController.getRideById);

router.post("/edit-profile", uploadProfile.single("avatar"), userController.editProfile);


router.patch("/upload-vehicle-docs", roleMiddleware("driver"), uploadMore.fields([
    { name: "vehicle_registration", maxCount: 1 },
    { name: "insurance_policy", maxCount: 1 },
    { name: "owner_certificate", maxCount: 1 },
    { name: "puc", maxCount: 1 },
]), userController.uploadVehicleDocs);


export default router;
