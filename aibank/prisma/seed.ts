import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../app/generated/prisma/client";
import { auth } from "../lib/auth";
import { generateBankAccountNumber } from "../lib/generateBankAccountNumber";
import { AddressLatLong } from "../lib/addr-lat-long";

const connectionString = process.env.DATABASE_URL ?? "";
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const transactionSeedCount = Number(process.env.TRANSACTION_SEED_COUNT ?? "1000000");
const batchSize = Number(process.env.TRANSACTION_BATCH_SIZE ?? "5000");

const userData = [
  {
    name: "sat rotana",
    email: "satrotana@gmail.com",
    password: "admin123",
  },
  {
    name: "pov sokny",
    email: "povsokny@gmail.com",
    password: "admin123",
  },
  {
    name: "main scam",
    email: "mainscam@gmail.com",
    password: "scam1234",
  },
  {
    name: "scam 01",
    email: "scam01@gmail.com",
    password: "scam1234",
  },
  {
    name: "scam 02",
    email: "scam02@gmail.com",
    password: "scam1234",
  },
  {
    name: "scam 03",
    email: "scam03@gmail.com",
    password: "scam1234",
  },
];

const fraudPatterns = [
  {
    type: "IMMEDIATE_LARGE_TRANSFER",
    riskScore: 92,
    description: "Immediate large transfer after account creation",
  },
  {
    type: "MANY_TO_ONE_CONSOLIDATION",
    riskScore: 90,
    description: "Many-to-one consolidation layering pattern",
  },
  {
    type: "MULTIPLE_SAME_AMOUNT",
    riskScore: 88,
    description: "Repeated same-amount transaction pattern",
  },
  {
    type: "VELOCITY_SPIKE",
    riskScore: 95,
    description: "Velocity spike within a short period",
  },
  {
    type: "LOCATION_JUMP",
    riskScore: 97,
    description: "Sudden location change across geographies",
  },
  {
    type: "SLEEP_AND_WAKE",
    riskScore: 93,
    description: "Dormant account waking with burst activity",
  },
];

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomElement<T>(items: T[]) {
  return items[getRandomInt(0, items.length - 1)];
}

function randomDateBetween(start: Date, end: Date) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function toDecimal(value: number) {
  return new Prisma.Decimal(value.toFixed(2));
}

export async function main() {
  for (const u of userData) {
    const isExist = await prisma.user.findUnique({
      where: {
        email: u.email,
      },
    });

    if (!isExist) {
      const user = await auth.api.signUpEmail({
        body: {
          email: u.email,
          password: u.password,
          name: u.name,
        },
      });
      console.log(`Seeding register sign-on ${user.user.email}, completed! ✅`);
    }
  }

  const users = await prisma.user.findMany();
  const mainAccountEmails = new Set([
    "satrotana@gmail.com",
    "povsokny@gmail.com",
    "mainscam@gmail.com",
  ]);

  for (const user of users) {
    const isMainAccount = mainAccountEmails.has(user.email);
    const existingAccount = await prisma.bankAccount.findFirst({
      where: {
        userId: user.id,
        accountName: user.name,
      },
    });

    if (!existingAccount) {
      await prisma.bankAccount.create({
        data: {
          accountName: user.name,
          accountNumber: generateBankAccountNumber(),
          accountType: "SAVINGS",
          balance: isMainAccount ? 5000000 : 0,
          currency: "USD",
          userId: user.id,
        },
      });

      console.log(`Seeded new account for ${user.email} ✅`);
    }
  }

  const accounts = await prisma.bankAccount.findMany({
    select: {
      id: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (accounts.length < 2) {
    throw new Error("At least two bank accounts are required for transaction seeding.");
  }

  const transactionCount = await prisma.transaction.count();

  if (transactionCount > 0) {
    console.log(`Transactions already exist (${transactionCount}); skipping transaction seeding.`);
  } else {
    const fraudCount = Math.floor(transactionSeedCount / 2);
    let createdCount = 0;
    let fraudIndex = 0;

    for (let offset = 0; offset < transactionSeedCount; offset += batchSize) {
      const batchData = [] as Array<{
        amount: Prisma.Decimal;
        currency: string;
        reference: string;
        description: string;
        latitude: string | null;
        longitude: string | null;
        isFraud: boolean;
        fraudType: string | null;
        riskScore: number;
        senderAccountId: string;
        receiverAccountId: string;
        createdAt: Date;
      }>;

      for (let i = 0; i < Math.min(batchSize, transactionSeedCount - offset); i += 1) {
        const globalIndex = offset + i;
        const isFraud = globalIndex < fraudCount;
        const sender = accounts[(globalIndex + 1) % accounts.length];
        const receiver = accounts[(globalIndex + 2) % accounts.length];
        const location = getRandomElement(AddressLatLong);
        const baseDate = new Date(accounts[0]?.createdAt ?? new Date());

        let amount = getRandomInt(50, 2000);
        let description = "Routine transfer";
        let latitude = String(location.latitude);
        let longitude = String(location.longitude);
        let fraudType: string | null = null;
        let riskScore = 0;
        let createdAt = randomDateBetween(baseDate, new Date());

        if (isFraud) {
          const pattern = fraudPatterns[fraudIndex % fraudPatterns.length];
          fraudIndex += 1;
          fraudType = pattern.type;
          riskScore = pattern.riskScore;
          description = pattern.description;

          switch (pattern.type) {
            case "IMMEDIATE_LARGE_TRANSFER":
              amount = getRandomInt(500000, 1500000);
              createdAt = randomDateBetween(new Date(baseDate.getTime() + 1000 * 60 * 60), new Date(baseDate.getTime() + 1000 * 60 * 60 * 24));
              break;
            case "MANY_TO_ONE_CONSOLIDATION":
              amount = getRandomInt(2500, 15000);
              createdAt = randomDateBetween(new Date(baseDate.getTime() + 1000 * 60 * 60 * 24 * 3), new Date(baseDate.getTime() + 1000 * 60 * 60 * 24 * 7));
              break;
            case "MULTIPLE_SAME_AMOUNT":
              amount = 2500;
              createdAt = randomDateBetween(new Date(baseDate.getTime() + 1000 * 60 * 60 * 24), new Date(baseDate.getTime() + 1000 * 60 * 60 * 24 * 2));
              break;
            case "VELOCITY_SPIKE":
              amount = getRandomInt(10000, 50000);
              createdAt = randomDateBetween(new Date(baseDate.getTime() + 1000 * 60 * 5), new Date(baseDate.getTime() + 1000 * 60 * 20));
              break;
            case "LOCATION_JUMP":
              amount = getRandomInt(20000, 100000);
              latitude = "48.8566";
              longitude = "2.3522";
              createdAt = randomDateBetween(new Date(baseDate.getTime() + 1000 * 60 * 60), new Date(baseDate.getTime() + 1000 * 60 * 60 * 4));
              break;
            case "SLEEP_AND_WAKE":
              amount = getRandomInt(250000, 800000);
              createdAt = randomDateBetween(new Date("2024-01-01T00:00:00.000Z"), new Date("2025-06-01T00:00:00.000Z"));
              break;
            default:
              break;
          }
        } else {
          amount = getRandomInt(20, 8000);
          createdAt = randomDateBetween(new Date(baseDate.getTime() - 1000 * 60 * 60 * 24 * 30), new Date());
        }

        batchData.push({
          amount: toDecimal(amount),
          currency: "USD",
          reference: `seed-${isFraud ? "fraud" : "normal"}-${globalIndex + 1}`,
          description,
          latitude,
          longitude,
          isFraud,
          fraudType,
          riskScore,
          senderAccountId: sender.id,
          receiverAccountId: receiver.id,
          createdAt,
        });
      }

      if (batchData.length > 0) {
        await prisma.transaction.createMany({
          data: batchData,
          skipDuplicates: true,
        });
        createdCount += batchData.length;
        console.log(`Seeded ${createdCount}/${transactionSeedCount} transactions...`);
      }
    }

    console.log(`Transaction seeding complete. Created ${createdCount} transactions.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});