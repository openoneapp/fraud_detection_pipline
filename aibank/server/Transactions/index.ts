"use server";

import prisma from "@/lib/prisma";
import { getBankAccounts } from "../BankAccounts";
import { createTransferProps } from "./schema";

export async function getTransactionData() {
  const resAcc = await getBankAccounts();
  const accountIds = resAcc.data?.map((acc) => acc.id) ?? [];

  try {
    const [rawTransactions, totalCount] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          OR: [
            { senderAccountId: { in: accountIds } },
            { receiverAccountId: { in: accountIds } },
          ],
        },
        orderBy: { createdAt: "desc" },
        include: {
          senderAccount: {
            select: {
              id: true,
              accountName: true,
              accountNumber: true,
            },
          },
          receiverAccount: {
            select: {
              id: true,
              accountName: true,
              accountNumber: true,
            },
          },
        },
        take: 100, // Limit for performance dashboard
      }),
      prisma.transaction.count({
        where: {
          OR: [
            { senderAccountId: { in: accountIds } },
            { receiverAccountId: { in: accountIds } },
          ],
        },
      }),
    ]);

    const transactions = rawTransactions.map((tran) => ({
      ...tran,
      amount: tran.amount.toString(),
      senderAccount: tran.senderAccount
        ? {
            id: tran.senderAccount.id,
            accountName: tran.senderAccount.accountName,
            accountNumber: tran.senderAccount.accountNumber,
          }
        : null,
      receiverAccount: {
        id: tran.receiverAccount.id,
        accountName: tran.receiverAccount.accountName,
        accountNumber: tran.receiverAccount.accountNumber,
      },
    }));

    // Quick calculations for the summary cards
    const totalVolume = rawTransactions
      .reduce((sum, tx) => sum + Number(tx.amount), 0)
      .toString();

    return {
      message: "Fetch transactions success.",
      data: {
        transactions: transactions,
        totalCount: totalCount,
        totalVolume: totalVolume,
      },
    };
  } catch (error) {
    return {
      message: "Fetch transactions failed.",
      data: {},
    };
  }
}

export async function createTransfer({
  value,
}: {
  value: createTransferProps;
}) {
  try {
    const resSenderAccAmt = await prisma.bankAccount.findUnique({
      where: {
        id: value.senderAccountId,
      },
      select: {
        balance: true,
      },
    });
    const senderAccAmt = resSenderAccAmt?.balance.toNumber() || 0;
    if (senderAccAmt < value.amount) {
      return {
        status: false,
        message: "Your amount less than transfer amount!",
      };
    }
    const deducAmt = senderAccAmt - value.amount;
    await prisma.bankAccount.update({
      where: {
        id: value.senderAccountId,
      },
      data: {
        balance: deducAmt,
      },
    });

    const resRecAccAmt = await prisma.bankAccount.findUnique({
      where: {
        id: value.receiverAccountId,
      },
      select: {
        balance: true,
      },
    });
    const recAccAmt = resRecAccAmt?.balance.toNumber() || 0;
    const addAmt = recAccAmt + value.amount;
    await prisma.bankAccount.update({
      where: {
        id: value.receiverAccountId,
      },
      data: {
        balance: addAmt,
      },
    });

    const resTran = await prisma.transaction.create({
      data: {
        amount: value.amount,
        currency: value.currency,
        description: value.description,
        latitude: value.latitude,
        longitude: value.longitude,
        receiverAccountId: value.receiverAccountId,
        senderAccountId: value.senderAccountId,
        reference: value.reference,
      },
      include: {
        senderAccount: {
          select: {
            id: true,
            accountName: true,
            accountNumber: true,
          },
        },
        receiverAccount: {
          select: {
            id: true,
            accountName: true,
            accountNumber: true,
          },
        },
      },
    });

    const transaction = {
      ...resTran,
      amount: resTran.amount.toString(),
      senderAccount: resTran.senderAccount
        ? {
            id: resTran.senderAccount.id,
            accountName: resTran.senderAccount.accountName,
            accountNumber: resTran.senderAccount.accountNumber,
          }
        : null,
      receiverAccount: resTran.receiverAccount
        ? {
            id: resTran.receiverAccount.id,
            accountName: resTran.receiverAccount.accountName,
            accountNumber: resTran.receiverAccount.accountNumber,
          }
        : null,
    };

    return {
      status: true,
      message: "Create transfer success.",
      data: transaction,
    };
  } catch (error) {
    console.log(error);
    return {
      status: false,
      message: "Create transactions failed.",
    };
  }
}
