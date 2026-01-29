import { v4 as uuid } from "uuid";
import { userRepository } from "../users/userRepository";
import { chipsRepository } from "./chipsRepository";

export const chipsService = {
  getBalance(userId: string): number {
    const user = userRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }
    return user.chips;
  },

  debit(userId: string, amount: number, reason: string, metadata?: Record<string, unknown>): number {
    if (amount <= 0) {
      throw new Error("Invalid amount");
    }

    const user = userRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const nextBalance = user.chips - amount;
    if (nextBalance < 0) {
      throw new Error("Insufficient chips");
    }

    userRepository.updateChips(userId, nextBalance);
    chipsRepository.recordTransaction({
      id: uuid(),
      userId,
      amount: -amount,
      reason,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
      createdAt: new Date().toISOString()
    });

    return nextBalance;
  },

  credit(userId: string, amount: number, reason: string, metadata?: Record<string, unknown>): number {
    if (amount <= 0) {
      throw new Error("Invalid amount");
    }

    const user = userRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const nextBalance = user.chips + amount;
    userRepository.updateChips(userId, nextBalance);
    chipsRepository.recordTransaction({
      id: uuid(),
      userId,
      amount,
      reason,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
      createdAt: new Date().toISOString()
    });

    return nextBalance;
  },
  history(userId: string, limit = 20): Array<{
    id: string;
    amount: number;
    reason: string;
    metadata?: string | null;
    createdAt: string;
  }> {
    return chipsRepository.listTransactions(userId, limit).map((row) => ({
      id: row.id,
      amount: row.amount,
      reason: row.reason,
      metadata: row.metadata ?? undefined,
      createdAt: row.created_at
    }));
  }
};
