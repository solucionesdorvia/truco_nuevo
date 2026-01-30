import { v4 as uuid } from "uuid";
import crypto from "crypto";
import { env } from "../env";
import { userRepository } from "./userRepository";
import { User } from "./types";

const hashPassword = (password: string): string => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
};

const verifyPassword = (password: string, storedHash: string): boolean => {
  const [salt, originalHash] = storedHash.split(":");
  if (!salt || !originalHash) return false;
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 64, "sha512").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(originalHash, "hex"));
};

export const userService = {
  createUser(username: string): User {
    const trimmed = username.trim();
    if (!trimmed) {
      throw new Error("Username is required");
    }

    const now = new Date().toISOString();
    const inviteCode = userService.generateInviteCode();
    const user: User = {
      id: uuid(),
      username: trimmed,
      passwordHash: null,
      chips: env.initialChips,
      bonusChips: 0,
      bonusLocked: 0,
      depositsTotal: 0,
      inviteCode,
      referredBy: null,
      referralBonusGiven: false,
      token: uuid(),
      createdAt: now
    };

    return userRepository.create(user);
  },

  registerUser(username: string, password: string, inviteCode?: string | null): User {
    const trimmed = username.trim();
    if (!trimmed) {
      throw new Error("Username is required");
    }
    if (!password || password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }
    if (userRepository.findByUsername(trimmed)) {
      throw new Error("Username already exists");
    }
    let referredBy: string | null = null;
    if (inviteCode) {
      const normalized = inviteCode.trim().toUpperCase();
      const referrer = userRepository.findByInviteCode(normalized);
      if (!referrer) {
        throw new Error("Invalid invite code");
      }
      referredBy = referrer.id;
    }
    const now = new Date().toISOString();
    const inviteCodeGenerated = userService.generateInviteCode();
    const user: User = {
      id: uuid(),
      username: trimmed,
      passwordHash: hashPassword(password),
      chips: env.initialChips,
      bonusChips: 0,
      bonusLocked: 0,
      depositsTotal: 0,
      inviteCode: inviteCodeGenerated,
      referredBy,
      referralBonusGiven: false,
      token: uuid(),
      createdAt: now
    };
    return userRepository.create(user);
  },

  login(username: string, password: string): User {
    const trimmed = username.trim();
    if (!trimmed) {
      throw new Error("Username is required");
    }
    const user = userRepository.findByUsername(trimmed);
    if (!user || !user.passwordHash) {
      throw new Error("Invalid credentials");
    }
    if (!verifyPassword(password, user.passwordHash)) {
      throw new Error("Invalid credentials");
    }
    return user;
  },

  generateInviteCode(): string {
    for (let i = 0; i < 5; i += 1) {
      const candidate = `TRUCO-${Math.floor(100000 + Math.random() * 900000)}`;
      if (!userRepository.findByInviteCode(candidate)) {
        return candidate;
      }
    }
    return `TRUCO-${uuid().slice(0, 6).toUpperCase()}`;
  },

  getByToken(token: string): User | null {
    return userRepository.findByToken(token);
  },

  getById(id: string): User | null {
    return userRepository.findById(id);
  },

  getByInviteCode(code: string): User | null {
    return userRepository.findByInviteCode(code);
  },

  setReferral(userId: string, referredBy: string): void {
    userRepository.setReferral(userId, referredBy);
  }
};
