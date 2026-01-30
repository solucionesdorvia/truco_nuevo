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

  getSummary(userId: string): {
    balance: number;
    bonusAvailable: number;
    bonusLocked: number;
  } {
    const user = userRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }
    return {
      balance: user.chips,
      bonusAvailable: user.bonusChips,
      bonusLocked: user.bonusLocked
    };
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

  deposit(userId: string, amount: number, metadata?: Record<string, unknown>): {
    balance: number;
    bonusAvailable: number;
    bonusLocked: number;
  } {
    if (amount <= 0) {
      throw new Error("Invalid amount");
    }

    const user = userRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const nextBalance = user.chips + amount;
    const nextDepositsTotal = user.depositsTotal + amount;
    let bonusLocked = user.bonusLocked;
    let bonusAvailable = user.bonusChips;

    userRepository.updateChips(userId, nextBalance);
    chipsRepository.recordTransaction({
      id: uuid(),
      userId,
      amount,
      reason: "deposit",
      metadata: metadata ? JSON.stringify(metadata) : undefined,
      createdAt: new Date().toISOString()
    });

    if (user.referredBy && !user.referralBonusGiven) {
      bonusLocked += 1000;
      chipsRepository.recordTransaction({
        id: uuid(),
        userId,
        amount: 1000,
        reason: "bonus_locked_referral",
        metadata: JSON.stringify({ source: "referral" }),
        createdAt: new Date().toISOString()
      });
      const referrer = userRepository.findById(user.referredBy);
      if (referrer) {
        userRepository.updateBonus(
          referrer.id,
          referrer.bonusChips,
          referrer.bonusLocked + 1000,
          referrer.depositsTotal
        );
        chipsRepository.recordTransaction({
          id: uuid(),
          userId: referrer.id,
          amount: 1000,
          reason: "bonus_locked_referral",
          metadata: JSON.stringify({ source: "referral_friend", userId }),
          createdAt: new Date().toISOString()
        });
      }
      userRepository.markReferralBonusGiven(userId);
    }

    if (user.referredBy) {
      const referrer = userRepository.findById(user.referredBy);
      if (referrer) {
        const percentBonus = Math.floor(amount * 0.01);
        if (percentBonus > 0) {
          userRepository.updateBonus(
            referrer.id,
            referrer.bonusChips + percentBonus,
            referrer.bonusLocked,
            referrer.depositsTotal
          );
          chipsRepository.recordTransaction({
            id: uuid(),
            userId: referrer.id,
            amount: percentBonus,
            reason: "bonus_referral_percent",
            metadata: JSON.stringify({ source: "referral_percent", userId }),
            createdAt: new Date().toISOString()
          });
        }
      }
    }

    if (bonusLocked > 0 && nextDepositsTotal >= bonusLocked) {
      bonusAvailable += bonusLocked;
      chipsRepository.recordTransaction({
        id: uuid(),
        userId,
        amount: bonusLocked,
        reason: "bonus_unlocked",
        metadata: JSON.stringify({ rule: "deposit_match" }),
        createdAt: new Date().toISOString()
      });
      bonusLocked = 0;
    }

    userRepository.updateBonus(userId, bonusAvailable, bonusLocked, nextDepositsTotal);

    return {
      balance: nextBalance,
      bonusAvailable,
      bonusLocked
    };
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
