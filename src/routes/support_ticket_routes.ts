import express from "express";
import { supportTicketController } from "../controllers/support_ticket_controller";
import tokenValidationMiddleware from "../middlewares/token_validator";
import {statusChecker} from "../middlewares/status_middleware";
import { uploadImage } from "../middlewares/upload";
import roleMiddleware from "../middlewares/role_middleware";

const router = express.Router();
router.use(tokenValidationMiddleware);
router.use(statusChecker);

// User routes
router.post("/create-ticket", uploadImage.array('attachments', 5), supportTicketController.createTicket);
router.get("/my-tickets", supportTicketController.getUserTickets);

// Admin routes
router.use(roleMiddleware("sub_admin, super_admin"));
// router.get("/all-tickets", supportTicketController.getAllTickets);
// router.patch("/update-status", supportTicketController.updateStatus);

router.get("/:ticketId", supportTicketController.getTicket);

export default router; 