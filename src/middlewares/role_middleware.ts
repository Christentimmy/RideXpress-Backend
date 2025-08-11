
import { Request, Response, NextFunction } from "express";


const roleMiddleware = (requiredRoles: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const userRole = res.locals.role;

        if (userRole === "super" || requiredRoles.split(" ").includes(userRole)) {
            next();
        } else {
            res.status(403).json({ message: "Access denied. You do not have the required role." });
            return;
        }
    };
};
export default roleMiddleware;