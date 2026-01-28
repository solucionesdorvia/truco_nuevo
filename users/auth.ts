import { Request, Response, NextFunction } from "express";
import { userService } from "./userService";
import { User } from "./types";

export interface AuthenticatedRequest extends Request {
  user: User;
}

const extractToken = (req: Request): string | null => {
  const headerToken = req.header("x-user-token");
  if (headerToken) {
    return headerToken;
  }

  const authHeader = req.header("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length);
  }

  return null;
};

export const requireUser = (req: Request, res: Response, next: NextFunction) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: "Missing auth token" });
  }

  const user = userService.getByToken(token);
  if (!user) {
    return res.status(401).json({ error: "Invalid auth token" });
  }

  (req as AuthenticatedRequest).user = user;
  return next();
};
