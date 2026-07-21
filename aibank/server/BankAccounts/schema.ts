import { AccountType } from "@/app/generated/prisma/enums";

export interface BankAccount {
  id: string;
  accountNumber: string;
  accountName: string;
  accountType: string;
  status: string;
  balance: number;
  currency: string;
  createdAt: string;
}

export interface BankAccountRequest {
  accountName: string;
  accountType: AccountType;
  balance: number;
}