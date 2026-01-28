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
    const user: User = {
      id: uuid(),
      username: trimmed,
      chips: env.initialChips,
      token: uuid(),
      createdAt: now
    };

    return userRepository.create(user);
  },

  getByToken(token: string): User | null {
    return userRepository.findByToken(token);
  },

  getById(id: string): User | null {
    return userRepository.findById(id);
  }
};
