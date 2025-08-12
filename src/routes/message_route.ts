import express from "express";
import { messageController } from "../controllers/message_controller";
import tokenValidationMiddleware from "../middlewares/token_validator";
import { statusChecker } from "../middlewares/status_middleware";
import { uploadMessageMedia } from "../middlewares/upload";
const router = express.Router();


router.use(tokenValidationMiddleware);
router.use(statusChecker);

router.post("/send",messageController.sendMessage);
router.get("/history/:otherUserId", messageController.getMessageHistory);
router.patch("/:messageId/read", messageController.markMessageAsRead);
router.get("/unread-count/:chatWith", messageController.getUnreadMessageCount);
router.get("/get-chat-list", messageController.getChatList);
router.post("/upload", uploadMessageMedia.single("file"), messageController.convertFileToMedia);
router.post("/upload-multiple-images", uploadMessageMedia.array("mul-images", 10), messageController.uploadMultipleImages);



export default router;
