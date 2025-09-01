import { Request, Response } from "express";
import { SupportTicket } from "../models/support_ticket_model";
import UserSchema from "../models/user_model";

import { sendEmail, sendBulkEmail } from "../services/email_service";
import { uploadToCloudinary } from "../middlewares/upload";

export const supportTicketController = {

    createTicket: async (req: Request, res: Response) => {
        try {
            const userId = res.locals.userId;
            const { subject, description, category, priority } = req.body;
            const files = req.files as Express.Multer.File[];

            if (!subject || !description || !category) {
                res.status(400).json({ message: "Subject, description, and category are required" });
                return;
            }

            // Upload files to Cloudinary if any
            let attachments: string[] = [];
            if (files && files.length > 0) {
                const uploadPromises = files.map(file =>
                    uploadToCloudinary(file, 'support-tickets')
                );

                const uploadResults = await Promise.all(uploadPromises);
                attachments = uploadResults.map((result: any) => result.secure_url);
            }

            const ticket = new SupportTicket({
                user: userId,
                subject,
                description,
                category,
                priority: priority || "medium",
                attachments,
                createdAt: new Date(),
            });

            await ticket.save();

            // Notify admin about new ticket
            const admins = await UserSchema.find({ role: { $in: ['super_admin', 'sub_admin'] } });
            const user = await UserSchema.findById(userId);

            if (user) {
                const adminEmails = admins.map(admin => admin.email);
                const message = `
                    New support ticket created by ${user.first_name} (${user.email})<br>
                    Subject: ${subject}<br>
                    Category: ${category}<br>
                    Priority: ${priority || 'medium'}<br>
                    Description: ${description}<br><br>
                    ${attachments.length > 0 ? `\nAttachments: ${attachments.join('\n')}` : ''}
                `;

                const emailResult = await sendBulkEmail(
                    adminEmails,
                    "New Support Ticket Created",
                    "Admin",
                    message
                );

                if (!emailResult.success) {
                    console.error("Failed to send admin notifications:", emailResult.error);
                }
            }

            res.status(201).json({
                message: "Support ticket created successfully",
                data: ticket
            });
        } catch (error) {
            console.error("createTicket error:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    },

    getUserTickets: async (req: Request, res: Response) => {
        try {
            const userId = res.locals.userId;
            const tickets = await SupportTicket.find({ user: userId })
                .populate("assignedTo", "name email")
                .sort({ createdAt: -1 });

            const response = tickets.map(ticket => ({
                _id: ticket._id,
                status: ticket.status,
                category: ticket.category,
                description: ticket.description,
                createdAt: ticket.createdAt,
                updatedAt: ticket.updatedAt
            }));

            res.status(200).json({
                message: "Tickets fetched successfully",
                data: response
            });
        } catch (error) {
            console.error("getUserTickets error:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    },

    getTicket: async (req: Request, res: Response) => {
        try {
            const { ticketId } = req.params;
            const userId = res.locals.userId;
            const userRole = res.locals.userRole;

            const ticket = await SupportTicket.findById(ticketId)
                .populate("user", "name email")
                .populate("assignedTo", "name email")
                .populate("responses.responder", "name email");

            if (!ticket) {
                res.status(404).json({ message: "Ticket not found" });
                return;
            }

            // Check if user has permission to view the ticket
            if (userRole !== 'super_admin' && userRole !== 'sub_admin' && ticket.user.toString() !== userId) {
                res.status(403).json({ message: "Unauthorized access" });
                return;
            }

            res.status(200).json({
                message: "Ticket fetched successfully",
                data: ticket
            });
        } catch (error) {
            console.error("getTicket error:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    },

    updateStatus: async (req: Request, res: Response) => {
        try {
            const { status, ticketId, priority } = req.body;
            if (!ticketId) {
                res.status(400).json({ message: "TicketId required" });
                return;
            }

            const admin = res.locals.admin;

            const ticket = await SupportTicket.findById(ticketId);
            if (!ticket) {
                res.status(404).json({ message: "Ticket not found" });
                return;
            }

            if (ticket.assignedTo == null) {
                ticket.assignedTo = admin._id;
            }

            if (status) {
                if (!["open", "in_progress", "resolved", "closed"].includes(status)) {
                    res.status(400).json({ message: "Invalid status value" });
                    return;
                }
                ticket.status = status;
            }

            if (priority) {
                if (!["low", "medium", "high"].includes(priority)) {
                    res.status(400).json({ message: "Invalid priority value" });
                    return;
                }
                ticket.priority = priority;
            }

            ticket.updatedAt = new Date();
            await ticket.save();

            const user = await UserSchema.findById(ticket.user);
            if (user) {
                const message = `
                    Your support ticket status has been updated:<br>
                    Subject: ${ticket.subject}<br>
                    New Status: ${status}<br>
                    ${admin ? `Assigned To: ${admin.name}` : ''}
                `;

                await sendEmail(user.email, "Support Ticket Status Updated", user.first_name, message);
            }

            res.status(200).json({ message: "Ticket status updated successfully" });
        } catch (error) {
            console.error("updateStatus error:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    },

    getAllTickets: async (req: Request, res: Response) => {
        try {
            const { status, priority, category } = req.query;
            const query: any = {};

            if (status) query.status = status;
            if (priority) query.priority = priority;
            if (category) query.category = category;

            const tickets = await SupportTicket.find(query)
                .populate("user", "full_name email avatar")
                .populate("assignedTo", "full_name email")
                .sort({ createdAt: -1 });

            res.status(200).json({
                message: "Tickets fetched successfully",
                data: tickets
            });
        } catch (error) {
            console.error("getAllTickets error:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    }

}; 