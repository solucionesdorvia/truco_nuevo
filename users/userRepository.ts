import db from "../db";
import { User } from "./types";

const mapRow = (row: any): User => ({
  id: row.id,
  username: row.username,
  chips: row.chips,
  bonusChips: row.bonus_chips ?? 0,
  bonusLocked: row.bonus_locked ?? 0,
  depositsTotal: row.deposits_total ?? 0,
  inviteCode: row.invite_code ?? null,
  referredBy: row.referred_by ?? null,
  referralBonusGiven: Boolean(row.referral_bonus_given ?? 0),
  token: row.token,
  createdAt: row.created_at
});

export const userRepository = {
  create(user: User): User {
    const stmt = db.prepare(
      "INSERT INTO users (id, username, chips, bonus_chips, bonus_locked, deposits_total, invite_code, referred_by, referral_bonus_given, token, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    stmt.run(
      user.id,
      user.username,
      user.chips,
      user.bonusChips,
      user.bonusLocked,
      user.depositsTotal,
      user.inviteCode,
      user.referredBy,
      user.referralBonusGiven ? 1 : 0,
      user.token,
      user.createdAt
    );
    return user;
  },

  findByToken(token: string): User | null {
    const row = db.prepare("SELECT * FROM users WHERE token = ?").get(token);
    return row ? mapRow(row) : null;
  },

  findById(id: string): User | null {
    const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
    return row ? mapRow(row) : null;
  },

  findByInviteCode(code: string): User | null {
    const row = db.prepare("SELECT * FROM users WHERE invite_code = ?").get(code);
    return row ? mapRow(row) : null;
  },

  updateChips(id: string, chips: number): void {
    db.prepare("UPDATE users SET chips = ? WHERE id = ?").run(chips, id);
  },

  updateBonus(id: string, bonusChips: number, bonusLocked: number, depositsTotal: number): void {
    db.prepare(
      "UPDATE users SET bonus_chips = ?, bonus_locked = ?, deposits_total = ? WHERE id = ?"
    ).run(bonusChips, bonusLocked, depositsTotal, id);
  },

  setReferral(id: string, referredBy: string): void {
    db.prepare("UPDATE users SET referred_by = ? WHERE id = ?").run(referredBy, id);
  },

  markReferralBonusGiven(id: string): void {
    db.prepare("UPDATE users SET referral_bonus_given = 1 WHERE id = ?").run(id);
  }
};
