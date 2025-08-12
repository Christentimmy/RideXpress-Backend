import express from "express";
import { userController } from "../controllers/user_controller";
import { uploadProfile } from "../middlewares/upload";
import tokenValidationMiddleware from "../middlewares/token_validator";
import { statusChecker } from "../middlewares/status_middleware";

const router = express.Router();

router.use(tokenValidationMiddleware);

router.post("/upload-profile", uploadProfile.single("avatar"), userController.uploadProfile);
router.get("/get-address", userController.getUserAddress);
router.post("/save-address", userController.saveAddress);

router.use(statusChecker);

router.post("/find-nearby-drivers", userController.findNearByDrivers);
router.get("/get-current-ride", userController.getCurrentRide);
router.post("/rate-driver", userController.rateDriver);
router.get("/get-ride/:rideId", userController.getRideById);


export default router;
