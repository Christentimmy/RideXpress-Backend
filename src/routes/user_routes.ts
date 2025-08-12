import express from "express";
import { userController } from "../controllers/user_controller";
import { uploadProfile } from "../middlewares/upload";
import tokenValidationMiddleware from "../middlewares/token_validator";

const router = express.Router();

router.use(tokenValidationMiddleware);

router.post("/upload-profile", uploadProfile.single("avatar"), userController.uploadProfile);
router.get("/get-address", userController.getUserAddress);
router.post("/save-address", userController.saveAddress);
router.post("/find-nearby-drivers", userController.findNearByDrivers);
router.get("/get-current-ride", userController.getCurrentRide);
router.post("/rate-driver", userController.rateDriver);



export default router;
