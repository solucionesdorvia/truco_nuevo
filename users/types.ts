export interface User {
  id: string;
  username: string;
  passwordHash: string | null;
  chips: number;
  bonusChips: number;
  bonusLocked: number;
  depositsTotal: number;
  inviteCode: string | null;
  referredBy: string | null;
  referralBonusGiven: boolean;
  token: string;
  createdAt: string;
}
