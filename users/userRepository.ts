import db from "../db";
import { User } from "./types";

const mapRow = (row: any): User => ({
  id: row.id,
  username: row.username,
  chips: row.chips,
  token: row.token,
  createdAt: row.created_at
});

export const userRepository = {
  create(user: User): User {
    const stmt = db.prepare(
      "INSERT INTO users (id, username, chips, token, created_at) VALUES (?, ?, ?, ?, ?)"
    );
    stmt.run(user.id, user.username, user.chips, user.token, user.createdAt);
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

  updateChips(id: string, chips: number): void {
    db.prepare("UPDATE users SET chips = ? WHERE id = ?").run(chips, id);
  }
};
