"use server";

import prisma from "@/lib/prisma";
import { BankAccount, BankAccountRequest } from "./schema";
import { AccountStatus } from "@/app/generated/prisma/enums";
import { Decimal } from "@prisma/client/runtime/index-browser";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { generateBankAccountNumber } from "@/lib/generateBankAccountNumber";

export async function getBankAccounts() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const userId = session?.user.id;

  try {
    const res = await prisma.bankAccount.findMany({
      where: {
        userId: userId,
      },
      select: {
        id: true,
        accountNumber: true,
        accountName: true,
        accountType: true,
        status: true,
        balance: true,
        currency: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const data: BankAccount[] = res.map((account) => ({
      id: account.id,
      accountNumber: account.accountNumber,
      accountName: account.accountName,
      accountType: account.accountType,
      status: account.status,
      balance: account.balance.toNumber(),
      currency: account.currency,
      createdAt: account.createdAt.toISOString(),
    }));

    return { success: true, data: data };
  } catch (error) {
    console.error("Database error:", error);
    return { success: false, error: "Failed to fetch bank Accounts" };
  }
}

export async function getBankAccountsTransfer() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const userId = session?.user.id;

  try {
    const resSource = await prisma.bankAccount.findMany({
      where: {
        status: "ACTIVE",
        userId: userId,
      },
      select: {
        id: true,
        accountNumber: true,
        accountName: true,
        accountType: true,
        status: true,
        balance: true,
        currency: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const resDestination = await prisma.bankAccount.findMany({
      where: {
        status: "ACTIVE",
        NOT: {
          userId: userId,
        },
      },
      select: {
        id: true,
        accountNumber: true,
        accountName: true,
        accountType: true,
        status: true,
        balance: true,
        currency: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const source: BankAccount[] = resSource.map((account) => ({
      id: account.id,
      accountNumber: account.accountNumber,
      accountName: account.accountName,
      accountType: account.accountType,
      status: account.status,
      balance: account.balance.toNumber(),
      currency: account.currency,
      createdAt: account.createdAt.toISOString(),
    }));
    const destination: BankAccount[] = resDestination.map((account) => ({
      id: account.id,
      accountNumber: account.accountNumber,
      accountName: account.accountName,
      accountType: account.accountType,
      status: account.status,
      balance: account.balance.toNumber(),
      currency: account.currency,
      createdAt: account.createdAt.toISOString(),
    }));

    return { success: true, data: { source, destination } };
  } catch (error) {
    console.error("Database error:", error);
    return { success: false, error: "Failed to fetch bank Accounts" };
  }
}

export async function createBankAccount({
  accountName,
  accountType,
  balance,
}: BankAccountRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const userId = session?.user.id;

  const generateNewAccount = await generateBankAccountNumber();

  try {
    await prisma.bankAccount.create({
      data: {
        accountNumber: generateNewAccount,
        accountName: accountName,
        accountType: accountType,
        status: AccountStatus.ACTIVE,
        balance: new Decimal(balance),
        currency: "USD",
        userId: userId || "",
      },
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to create bank Accounts" };
  }
}
