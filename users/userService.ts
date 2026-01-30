import { v4 as uuid } from "uuid";
import { env } from "../env";
import { userRepository } from "./userRepository";
import { User } from "./types";

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
