import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  Prisma,
} from "../app/generated/prisma/client";

import crypto from "crypto";

/**
 * ============================================================
 * DATABASE
 * ============================================================
 */

const connectionString =
  process.env.DATABASE_URL!;

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

/**
 * ============================================================
 * CONFIGURATION
 * ============================================================
 */

const TOTAL_USERS = 100;

/**
 * IMPORTANT
 *
 * FRAUD_PER_TYPE = 50,000
 *
 * 6 fraud types:
 *
 * 1. Immediate Large Transfer
 * 2. Many-to-One Consolidation
 * 3. Multiple Same Amount
 * 4. Velocity Spike
 * 5. Location Jump
 * 6. Sleep and Wake
 *
 * 6 × 50,000 = 300,000 fraud transactions
 *
 * Location Jump also creates
 * 50,000 normal historical transactions.
 *
 * Therefore:
 *
 * 300,000 fraud
 * 500,000 normal standalone
 *  50,000 location history
 * -------------------------
 * 850,000 total
 */
const FRAUD_PER_TYPE = 50_000;

const TOTAL_FRAUD_TRANSACTIONS =
  FRAUD_PER_TYPE * 6;

const LOCATION_JUMP_HISTORY_COUNT =
  FRAUD_PER_TYPE;

const TOTAL_NORMAL_TRANSACTIONS =
  650_000 +
  LOCATION_JUMP_HISTORY_COUNT;

const TOTAL_TRANSACTIONS =
  TOTAL_FRAUD_TRANSACTIONS +
  TOTAL_NORMAL_TRANSACTIONS;

const STANDALONE_NORMAL_COUNT =
  650_000;

/**
 * Insert at most 10,000 rows per batch.
 */
const BATCH_SIZE = 10_000;

/**
 * Dataset current time.
 *
 * All transactions must be <= this date.
 */
const NOW = new Date(
  "2026-07-24T12:00:00.000Z",
);

/**
 * ============================================================
 * FRAUD TYPES
 * ============================================================
 */

enum FraudType {
  IMMEDIATE_LARGE_TRANSFER =
    "IMMEDIATE_LARGE_TRANSFER",

  MANY_TO_ONE_CONSOLIDATION =
    "MANY_TO_ONE_CONSOLIDATION",

  MULTIPLE_SAME_AMOUNT =
    "MULTIPLE_SAME_AMOUNT",

  VELOCITY_SPIKE =
    "VELOCITY_SPIKE",

  LOCATION_JUMP =
    "LOCATION_JUMP",

  SLEEP_AND_WAKE =
    "SLEEP_AND_WAKE",
}

/**
 * ============================================================
 * LOCATIONS
 * ============================================================
 */

const LOCATIONS = {
  PHNOM_PENH: {
    latitude: "11.5564",
    longitude: "104.9282",
  },

  PARIS: {
    latitude: "48.8566",
    longitude: "2.3522",
  },
};

/**
 * ============================================================
 * TYPES
 * ============================================================
 */

type Account = {
  id: string;
  accountNumber: string;
  accountName: string;
  accountType: any;
  status: any;
  balance: Prisma.Decimal;
  currency: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * ============================================================
 * HELPERS
 * ============================================================
 */

function uuid() {
  return crypto.randomUUID();
}

function randomInt(
  min: number,
  max: number,
) {
  return Math.floor(
    Math.random() *
      (max - min + 1),
  ) + min;
}

function randomFloat(
  min: number,
  max: number,
) {
  return (
    Math.random() *
      (max - min) +
    min
  );
}

function randomElement<T>(
  array: T[],
): T {
  return array[
    Math.floor(
      Math.random() *
        array.length,
    )
  ];
}

function addMinutes(
  date: Date,
  minutes: number,
) {
  return new Date(
    date.getTime() +
      minutes *
        60 *
        1000,
  );
}

function addHours(
  date: Date,
  hours: number,
) {
  return new Date(
    date.getTime() +
      hours *
        60 *
        60 *
        1000,
  );
}

function addDays(
  date: Date,
  days: number,
) {
  return new Date(
    date.getTime() +
      days *
        24 *
        60 *
        60 *
        1000,
  );
}

function randomDateBetween(
  start: Date,
  end: Date,
) {
  const startTime =
    start.getTime();

  const endTime =
    end.getTime();

  if (
    startTime >
    endTime
  ) {
    throw new Error(
      `Invalid date range: ${start.toISOString()} > ${end.toISOString()}`,
    );
  }

  return new Date(
    startTime +
      Math.random() *
        (endTime - startTime),
  );
}

function randomAmount(
  min: number,
  max: number,
) {
  return new Prisma.Decimal(
    randomFloat(
      min,
      max,
    ).toFixed(2),
  );
}

function generateReference() {
  return `TXN-${uuid()}`;
}

function generateAccountNumber(
  index: number,
) {
  return `100000${String(
    index,
  ).padStart(8, "0")}`;
}

/**
 * ============================================================
 * DATE HELPERS
 * ============================================================
 */

/**
 * The transaction must happen after:
 *
 * - sender account creation
 * - receiver account creation
 */
function getEarliestValidDate(
  sender: Account | null,
  receiver: Account,
) {
  const dates: Date[] = [
    receiver.createdAt,
  ];

  if (sender) {
    dates.push(
      sender.createdAt,
    );
  }

  return new Date(
    Math.max(
      ...dates.map(
        (date) =>
          date.getTime(),
      ),
    ),
  );
}

/**
 * All accounts involved in a group
 * must already exist before the group starts.
 */
function getEarliestDate(
  accounts: Account[],
) {
  return new Date(
    Math.max(
      ...accounts.map(
        (account) =>
          account.createdAt.getTime(),
      ),
    ),
  );
}

/**
 * Return a random valid group start time.
 *
 * `durationMinutes` is the duration of
 * the entire group.
 *
 * Example:
 *
 * baseTime
 *   ↓ +8h
 *   ↓ +16h
 *   ↓ +24h
 *   ↓ +32h
 *
 * The base time must be <= NOW - 32 hours.
 */
function getValidGroupBaseTime(
  earliestDate: Date,
  durationMinutes: number,
  windowStart: Date,
) {
  const latestBaseTime =
    addMinutes(
      NOW,
      -durationMinutes,
    );

  const startDate =
    earliestDate > windowStart
      ? earliestDate
      : windowStart;

  if (
    startDate >
    latestBaseTime
  ) {
    return null;
  }

  return randomDateBetween(
    startDate,
    latestBaseTime,
  );
}

/**
 * ============================================================
 * USER GENERATION
 * ============================================================
 */

async function createUsers() {
  console.log(
    `Creating ${TOTAL_USERS} users...`,
  );

  const users = [];

  for (
    let i = 1;
    i <= TOTAL_USERS;
    i++
  ) {
    users.push({
      id: uuid(),

      name: `Test User ${i}`,

      email:
        `testuser${i}@example.com`,

      emailVerified: true,

      image: null,

      createdAt:
        addDays(
          NOW,
          -randomInt(
            365,
            730,
          ),
        ),

      updatedAt: NOW,
    });
  }

  await prisma.user.createMany({
    data: users,

    skipDuplicates: true,
  });

  return prisma.user.findMany({
    where: {
      email: {
        startsWith:
          "testuser",
      },
    },

    orderBy: {
      email: "asc",
    },
  });
}

/**
 * ============================================================
 * BANK ACCOUNT GENERATION
 * ============================================================
 */

async function createBankAccounts(
  users: Awaited<
    ReturnType<typeof createUsers>
  >,
) {
  console.log(
    "Creating bank accounts...",
  );

  const accounts = [];

  let accountIndex = 1;

  /**
   * First 20 accounts are recently created.
   *
   * Used for Immediate Large Transfer.
   */
  const immediateAccountCount =
    Math.min(
      20,
      users.length,
    );

  for (
    let i = 0;
    i < users.length;
    i++
  ) {
    const user =
      users[i];

    let createdAt: Date;

    if (
      i <
      immediateAccountCount
    ) {
      createdAt =
        addHours(
          NOW,
          -randomInt(
            1,
            12,
          ),
        );
    } else {
      createdAt =
        addDays(
          NOW,
          -randomInt(
            120,
            730,
          ),
        );
    }

    accounts.push({
      id: uuid(),

      accountNumber:
        generateAccountNumber(
          accountIndex++,
        ),

      accountName:
        user.name,

      accountType:
        "SAVINGS" as any,

      status:
        "ACTIVE" as any,

      balance:
        new Prisma.Decimal(
          randomFloat(
            10_000,
            500_000,
          ).toFixed(2),
        ),

      currency: "USD",

      userId: user.id,

      createdAt,

      updatedAt: NOW,
    });
  }

  await prisma.bankAccount.createMany({
    data: accounts,

    skipDuplicates: true,
  });

  return prisma.bankAccount.findMany({
    orderBy: {
      createdAt: "asc",
    },
  });
}

/**
 * ============================================================
 * NORMAL TRANSACTION
 * ============================================================
 */

function generateNormalTransaction(
  accounts: Account[],
) {
  const sender =
    randomElement(accounts);

  let receiver =
    randomElement(accounts);

  while (
    receiver.id ===
    sender.id
  ) {
    receiver =
      randomElement(accounts);
  }

  const earliestDate =
    getEarliestValidDate(
      sender,
      receiver,
    );

  const createdAt =
    randomDateBetween(
      earliestDate,
      NOW,
    );

  return {
    id: uuid(),

    amount:
      randomAmount(
        10,
        10_000,
      ),

    currency: "USD",

    reference:
      generateReference(),

    description:
      "Normal bank transfer",

    latitude:
      LOCATIONS.PHNOM_PENH
        .latitude,

    longitude:
      LOCATIONS.PHNOM_PENH
        .longitude,

    isFraud: false,

    fraudType: null,

    riskScore: randomInt(
      0,
      20,
    ),

    senderAccountId:
      sender.id,

    receiverAccountId:
      receiver.id,

    createdAt,
  };
}

/**
 * ============================================================
 * IMMEDIATE LARGE TRANSFER
 * ============================================================
 */

function generateImmediateLargeTransfer(
  sender: Account,
  receiver: Account,
) {
  const transactionTime =
    addHours(
      sender.createdAt,
      randomInt(
        1,
        24,
      ),
    );

  if (
    transactionTime >
    NOW
  ) {
    return null;
  }

  if (
    transactionTime <
    receiver.createdAt
  ) {
    return null;
  }

  return {
    id: uuid(),

    amount:
      randomAmount(
        500_000,
        2_000_000,
      ),

    currency: "USD",

    reference:
      generateReference(),

    description:
      "Large transfer immediately after account creation",

    latitude:
      LOCATIONS.PHNOM_PENH
        .latitude,

    longitude:
      LOCATIONS.PHNOM_PENH
        .longitude,

    isFraud: true,

    fraudType:
      FraudType.IMMEDIATE_LARGE_TRANSFER,

    riskScore: randomInt(
      85,
      100,
    ),

    senderAccountId:
      sender.id,

    receiverAccountId:
      receiver.id,

    createdAt:
      transactionTime,
  };
}

/**
 * ============================================================
 * MANY-TO-ONE
 * ============================================================
 *
 * 5 senders
 * 1 receiver
 *
 * 5 transactions.
 *
 * 8 hours between transactions.
 *
 * Total group duration:
 *
 * 0h
 * 8h
 * 16h
 * 24h
 * 32h
 *
 * = 32 hours
 */

function generateManyToOneGroup(
  accounts: Account[],
) {
  const shuffled =
    [...accounts].sort(
      () =>
        Math.random() -
        0.5,
    );

  const senders =
    shuffled.slice(
      0,
      5,
    );

  const receiver =
    shuffled[5];

  const groupAccounts = [
    ...senders,
    receiver,
  ];

  const earliestDate =
    getEarliestDate(
      groupAccounts,
    );

  const threeDaysAgo =
    addDays(
      NOW,
      -3,
    );

  /**
   * Last transaction is +32 hours.
   */
  const baseTime =
    getValidGroupBaseTime(
      earliestDate,
      32 * 60,
      threeDaysAgo,
    );

  if (!baseTime) {
    return null;
  }

  return senders.map(
    (
      sender,
      index,
    ) => ({
      id: uuid(),

      amount:
        randomAmount(
          20_000,
          150_000,
        ),

      currency: "USD",

      reference:
        generateReference(),

      description:
        "Many senders consolidating funds into one receiver",

      latitude:
        LOCATIONS.PHNOM_PENH
          .latitude,

      longitude:
        LOCATIONS.PHNOM_PENH
          .longitude,

      isFraud: true,

      fraudType:
        FraudType.MANY_TO_ONE_CONSOLIDATION,

      riskScore: randomInt(
        75,
        95,
      ),

      senderAccountId:
        sender.id,

      receiverAccountId:
        receiver.id,

      createdAt:
        addHours(
          baseTime,
          index * 8,
        ),
    }),
  );
}

/**
 * ============================================================
 * MULTIPLE SAME AMOUNT
 * ============================================================
 *
 * 1 sender
 * 5 receivers
 *
 * Same amount.
 *
 * 5 minutes between transactions.
 *
 * Total duration = 20 minutes.
 */

function generateSameAmountGroup(
  accounts: Account[],
) {
  const sender =
    randomElement(accounts);

  const receivers =
    accounts
      .filter(
        (account) =>
          account.id !==
          sender.id,
      )
      .sort(
        () =>
          Math.random() -
          0.5,
      )
      .slice(
        0,
        5,
      );

  const groupAccounts = [
    sender,
    ...receivers,
  ];

  const earliestDate =
    getEarliestDate(
      groupAccounts,
    );

  const oneDayAgo =
    addDays(
      NOW,
      -1,
    );

  const baseTime =
    getValidGroupBaseTime(
      earliestDate,
      20,
      oneDayAgo,
    );

  if (!baseTime) {
    return null;
  }

  const sameAmount =
    new Prisma.Decimal(
      randomInt(
        2_000,
        10_000,
      ),
    );

  return receivers.map(
    (
      receiver,
      index,
    ) => ({
      id: uuid(),

      amount:
        sameAmount,

      currency: "USD",

      reference:
        generateReference(),

      description:
        "Repeated same amount sent to multiple receivers",

      latitude:
        LOCATIONS.PHNOM_PENH
          .latitude,

      longitude:
        LOCATIONS.PHNOM_PENH
          .longitude,

      isFraud: true,

      fraudType:
        FraudType.MULTIPLE_SAME_AMOUNT,

      riskScore: randomInt(
        70,
        90,
      ),

      senderAccountId:
        sender.id,

      receiverAccountId:
        receiver.id,

      createdAt:
        addMinutes(
          baseTime,
          index * 5,
        ),
    }),
  );
}

/**
 * ============================================================
 * VELOCITY SPIKE
 * ============================================================
 *
 * 6 or 8 transactions.
 *
 * 5 minutes between transactions.
 *
 * Maximum group duration:
 *
 * 8 transactions:
 *
 * 0
 * 5
 * 10
 * 15
 * 20
 * 25
 * 30
 * 35
 *
 * = 35 minutes.
 */

function generateVelocityGroup(
  accounts: Account[],
  transactionCount: number,
) {
  const sender =
    randomElement(accounts);

  const receivers =
    accounts
      .filter(
        (account) =>
          account.id !==
          sender.id,
      )
      .sort(
        () =>
          Math.random() -
          0.5,
      )
      .slice(
        0,
        transactionCount,
      );

  if (
    receivers.length !==
    transactionCount
  ) {
    return null;
  }

  const groupAccounts = [
    sender,
    ...receivers,
  ];

  const earliestDate =
    getEarliestDate(
      groupAccounts,
    );

  const oneHourAgo =
    addMinutes(
      NOW,
      -60,
    );

  const durationMinutes =
    (transactionCount - 1) *
    5;

  const baseTime =
    getValidGroupBaseTime(
      earliestDate,
      durationMinutes,
      oneHourAgo,
    );

  if (!baseTime) {
    return null;
  }

  return receivers.map(
    (
      receiver,
      index,
    ) => ({
      id: uuid(),

      amount:
        randomAmount(
          50_000,
          200_000,
        ),

      currency: "USD",

      reference:
        generateReference(),

      description:
        "High velocity transaction burst",

      latitude:
        LOCATIONS.PHNOM_PENH
          .latitude,

      longitude:
        LOCATIONS.PHNOM_PENH
          .longitude,

      isFraud: true,

      fraudType:
        FraudType.VELOCITY_SPIKE,

      riskScore: randomInt(
        80,
        98,
      ),

      senderAccountId:
        sender.id,

      receiverAccountId:
        receiver.id,

      createdAt:
        addMinutes(
          baseTime,
          index * 5,
        ),
    }),
  );
}

/**
 * ============================================================
 * LOCATION JUMP
 * ============================================================
 *
 * Previous:
 *
 * Phnom Penh
 *       ↓
 * 30 minutes
 *       ↓
 * Paris
 */

function generateLocationJumpGroup(
  accounts: Account[],
) {
  const sender =
    randomElement(accounts);

  const receiver =
    randomElement(
      accounts.filter(
        (account) =>
          account.id !==
          sender.id,
      ),
    );

  const earliestDate =
    getEarliestValidDate(
      sender,
      receiver,
    );

  const latestCurrentTime =
    addMinutes(
      NOW,
      -30,
    );

  const earliestCurrentTime =
    addMinutes(
      earliestDate,
      30,
    );

  if (
    earliestCurrentTime >
    latestCurrentTime
  ) {
    return null;
  }

  const currentTime =
    randomDateBetween(
      earliestCurrentTime,
      latestCurrentTime,
    );

  const previousTime =
    addMinutes(
      currentTime,
      -30,
    );

  const previousTransaction = {
    id: uuid(),

    amount:
      randomAmount(
        100,
        5_000,
      ),

    currency: "USD",

    reference:
      generateReference(),

    description:
      "Previous transaction in Phnom Penh",

    latitude:
      LOCATIONS.PHNOM_PENH
        .latitude,

    longitude:
      LOCATIONS.PHNOM_PENH
        .longitude,

    isFraud: false,

    fraudType: null,

    riskScore: randomInt(
      0,
      20,
    ),

    senderAccountId:
      sender.id,

    receiverAccountId:
      receiver.id,

    createdAt:
      previousTime,
  };

  const fraudTransaction = {
    id: uuid(),

    amount:
      randomAmount(
        50_000,
        200_000,
      ),

    currency: "USD",

    reference:
      generateReference(),

    description:
      "Impossible travel from Phnom Penh to Paris",

    latitude:
      LOCATIONS.PARIS
        .latitude,

    longitude:
      LOCATIONS.PARIS
        .longitude,

    isFraud: true,

    fraudType:
      FraudType.LOCATION_JUMP,

    riskScore: 100,

    senderAccountId:
      sender.id,

    receiverAccountId:
      receiver.id,

    createdAt:
      currentTime,
  };

  return {
    previousTransaction,
    fraudTransaction,
  };
}

/**
 * ============================================================
 * SLEEP AND WAKE
 * ============================================================
 */

function generateSleepWakeGroup(
  accounts: Account[],
) {
  const sender =
    randomElement(accounts);

  const receivers =
    accounts
      .filter(
        (account) =>
          account.id !==
          sender.id,
      )
      .sort(
        () =>
          Math.random() -
          0.5,
      )
      .slice(
        0,
        4,
      );

  const wakeDate =
    new Date(
      "2026-04-01T08:00:00.000Z",
    );

  const allAccounts = [
    sender,
    ...receivers,
  ];

  const invalidAccount =
    allAccounts.find(
      (account) =>
        account.createdAt >
        wakeDate,
    );

  if (
    invalidAccount
  ) {
    return null;
  }

  const amounts = [
    300_000,
    500_000,
    700_000,
    400_000,
  ];

  return receivers.map(
    (
      receiver,
      index,
    ) => ({
      id: uuid(),

      amount:
        new Prisma.Decimal(
          amounts[index],
        ),

      currency: "USD",

      reference:
        generateReference(),

      description:
        "Dormant account suddenly wakes up with high-value transaction burst",

      latitude:
        LOCATIONS.PHNOM_PENH
          .latitude,

      longitude:
        LOCATIONS.PHNOM_PENH
          .longitude,

      isFraud: true,

      fraudType:
        FraudType.SLEEP_AND_WAKE,

      riskScore: randomInt(
        85,
        100,
      ),

      senderAccountId:
        sender.id,

      receiverAccountId:
        receiver.id,

      createdAt:
        addMinutes(
          wakeDate,
          index * 10,
        ),
    }),
  );
}

/**
 * ============================================================
 * VALIDATION
 * ============================================================
 */

function validateTransaction(
  transaction: any,
  accountMap: Map<
    string,
    Account
  >,
) {
  const sender =
    transaction.senderAccountId
      ? accountMap.get(
          transaction.senderAccountId,
        )
      : null;

  const receiver =
    accountMap.get(
      transaction.receiverAccountId,
    );

  if (
    !receiver
  ) {
    throw new Error(
      `Receiver account not found: ${transaction.receiverAccountId}`,
    );
  }

  if (
    sender &&
    transaction.createdAt <
      sender.createdAt
  ) {
    throw new Error(
      [
        "TRANSACTION BEFORE SENDER ACCOUNT",

        `Transaction: ${transaction.createdAt.toISOString()}`,

        `Sender: ${sender.createdAt.toISOString()}`,
      ].join("\n"),
    );
  }

  if (
    transaction.createdAt <
    receiver.createdAt
  ) {
    throw new Error(
      [
        "TRANSACTION BEFORE RECEIVER ACCOUNT",

        `Transaction: ${transaction.createdAt.toISOString()}`,

        `Receiver: ${receiver.createdAt.toISOString()}`,
      ].join("\n"),
    );
  }

  if (
    transaction.createdAt >
    NOW
  ) {
    throw new Error(
      [
        "FUTURE TRANSACTION",

        `Transaction: ${transaction.createdAt.toISOString()}`,

        `NOW: ${NOW.toISOString()}`,
      ].join("\n"),
    );
  }
}

/**
 * ============================================================
 * INSERT BATCH
 * ============================================================
 */

async function insertBatch(
  batch: any[],
  accountMap: Map<
    string,
    Account
  >,
) {
  for (
    const transaction of
    batch
  ) {
    validateTransaction(
      transaction,
      accountMap,
    );
  }

  await prisma.transaction.createMany({
    data: batch,

    skipDuplicates: true,
  });
}

/**
 * ============================================================
 * GENERATE NORMAL TRANSACTIONS
 * ============================================================
 */

async function generateNormalTransactions(
  accounts: Account[],
  accountMap: Map<
    string,
    Account
  >,
) {
  console.log(
    `Generating ${STANDALONE_NORMAL_COUNT.toLocaleString()} standalone normal transactions...`,
  );

  let inserted = 0;

  while (
    inserted <
    STANDALONE_NORMAL_COUNT
  ) {
    const remaining =
      STANDALONE_NORMAL_COUNT -
      inserted;

    const currentBatchSize =
      Math.min(
        BATCH_SIZE,
        remaining,
      );

    const batch = [];

    for (
      let i = 0;
      i < currentBatchSize;
      i++
    ) {
      batch.push(
        generateNormalTransaction(
          accounts,
        ),
      );
    }

    await insertBatch(
      batch,
      accountMap,
    );

    inserted +=
      batch.length;

    console.log(
      `Normal: ${inserted.toLocaleString()} / ${STANDALONE_NORMAL_COUNT.toLocaleString()}`,
    );
  }
}

/**
 * ============================================================
 * GENERATE IMMEDIATE LARGE TRANSFER
 * ============================================================
 */

async function generateImmediateFraud(
  accounts: Account[],
  accountMap: Map<
    string,
    Account
  >,
) {
  console.log(
    "Generating Immediate Large Transfer fraud...",
  );

  let inserted = 0;

  let batch: any[] = [];

  while (
    inserted <
    FRAUD_PER_TYPE
  ) {
    const sender =
      randomElement(accounts);

    const receiver =
      randomElement(
        accounts.filter(
          (account) =>
            account.id !==
            sender.id,
        ),
      );

    const transaction =
      generateImmediateLargeTransfer(
        sender,
        receiver,
      );

    if (
      transaction
    ) {
      batch.push(
        transaction,
      );

      inserted++;
    }

    if (
      batch.length >=
      BATCH_SIZE
    ) {
      await insertBatch(
        batch,
        accountMap,
      );

      batch = [];

      console.log(
        `Immediate Large Transfer: ${inserted.toLocaleString()} / ${FRAUD_PER_TYPE.toLocaleString()}`,
      );
    }
  }

  if (
    batch.length > 0
  ) {
    await insertBatch(
      batch,
      accountMap,
    );
  }
}

/**
 * ============================================================
 * GENERATE MANY-TO-ONE
 * ============================================================
 */

async function generateManyToOneFraud(
  accounts: Account[],
  accountMap: Map<
    string,
    Account
  >,
) {
  console.log(
    "Generating Many-to-One fraud...",
  );

  const GROUP_SIZE = 5;

  const GROUP_COUNT =
    FRAUD_PER_TYPE /
    GROUP_SIZE;

  let inserted = 0;

  let batch: any[] = [];

  let attempts = 0;

  for (
    let i = 0;
    i < GROUP_COUNT;
    i++
  ) {
    let group = null;

    while (
      !group
    ) {
      attempts++;

      if (
        attempts >
        1_000_000
      ) {
        throw new Error(
          "Could not generate valid Many-to-One groups",
        );
      }

      group =
        generateManyToOneGroup(
          accounts,
        );
    }

    batch.push(
      ...group,
    );

    inserted +=
      group.length;

    if (
      batch.length >=
      BATCH_SIZE
    ) {
      await insertBatch(
        batch,
        accountMap,
      );

      batch = [];

      console.log(
        `Many-to-One: ${inserted.toLocaleString()} / ${FRAUD_PER_TYPE.toLocaleString()}`,
      );
    }
  }

  if (
    batch.length > 0
  ) {
    await insertBatch(
      batch,
      accountMap,
    );
  }
}

/**
 * ============================================================
 * GENERATE SAME AMOUNT
 * ============================================================
 */

async function generateSameAmountFraud(
  accounts: Account[],
  accountMap: Map<
    string,
    Account
  >,
) {
  console.log(
    "Generating Multiple Same Amount fraud...",
  );

  const GROUP_SIZE = 5;

  const GROUP_COUNT =
    FRAUD_PER_TYPE /
    GROUP_SIZE;

  let inserted = 0;

  let batch: any[] = [];

  let attempts = 0;

  for (
    let i = 0;
    i < GROUP_COUNT;
    i++
  ) {
    let group = null;

    while (
      !group
    ) {
      attempts++;

      if (
        attempts >
        1_000_000
      ) {
        throw new Error(
          "Could not generate valid Same Amount groups",
        );
      }

      group =
        generateSameAmountGroup(
          accounts,
        );
    }

    batch.push(
      ...group,
    );

    inserted +=
      group.length;

    if (
      batch.length >=
      BATCH_SIZE
    ) {
      await insertBatch(
        batch,
        accountMap,
      );

      batch = [];

      console.log(
        `Same Amount: ${inserted.toLocaleString()} / ${FRAUD_PER_TYPE.toLocaleString()}`,
      );
    }
  }

  if (
    batch.length > 0
  ) {
    await insertBatch(
      batch,
      accountMap,
    );
  }
}

/**
 * ============================================================
 * GENERATE VELOCITY SPIKE
 * ============================================================
 */

async function generateVelocityFraud(
  accounts: Account[],
  accountMap: Map<
    string,
    Account
  >,
) {
  console.log(
    "Generating Velocity Spike fraud...",
  );

  const SIX_TRANSACTION_GROUPS =
    Math.floor(
      FRAUD_PER_TYPE /
        6,
    );

  const REMAINING =
    FRAUD_PER_TYPE -
    SIX_TRANSACTION_GROUPS *
      6;

  let inserted = 0;

  let batch: any[] = [];

  let attempts = 0;

  for (
    let i = 0;
    i <
    SIX_TRANSACTION_GROUPS;
    i++
  ) {
    let group = null;

    while (
      !group
    ) {
      attempts++;

      if (
        attempts >
        1_000_000
      ) {
        throw new Error(
          "Could not generate valid Velocity groups",
        );
      }

      group =
        generateVelocityGroup(
          accounts,
          6,
        );
    }

    batch.push(
      ...group,
    );

    inserted +=
      group.length;

    if (
      batch.length >=
      BATCH_SIZE
    ) {
      await insertBatch(
        batch,
        accountMap,
      );

      batch = [];

      console.log(
        `Velocity: ${inserted.toLocaleString()} / ${FRAUD_PER_TYPE.toLocaleString()}`,
      );
    }
  }

  if (
    REMAINING > 0
  ) {
    let group = null;

    while (
      !group
    ) {
      attempts++;

      if (
        attempts >
        1_000_000
      ) {
        throw new Error(
          "Could not generate remaining Velocity group",
        );
      }

      group =
        generateVelocityGroup(
          accounts,
          REMAINING,
        );
    }

    batch.push(
      ...group,
    );

    inserted +=
      group.length;
  }

  if (
    batch.length > 0
  ) {
    await insertBatch(
      batch,
      accountMap,
    );
  }

  console.log(
    `Velocity: ${inserted.toLocaleString()} / ${FRAUD_PER_TYPE.toLocaleString()}`,
  );
}

/**
 * ============================================================
 * GENERATE LOCATION JUMP
 * ============================================================
 */

async function generateLocationJumpFraud(
  accounts: Account[],
  accountMap: Map<
    string,
    Account
  >,
) {
  console.log(
    "Generating Location Jump fraud...",
  );

  let fraudInserted = 0;

  let historyInserted = 0;

  let batch: any[] = [];

  while (
    fraudInserted <
    FRAUD_PER_TYPE
  ) {
    const group =
      generateLocationJumpGroup(
        accounts,
      );

    if (
      !group
    ) {
      continue;
    }

    batch.push(
      group.previousTransaction,
    );

    batch.push(
      group.fraudTransaction,
    );

    historyInserted++;

    fraudInserted++;

    if (
      batch.length >=
      BATCH_SIZE
    ) {
      await insertBatch(
        batch,
        accountMap,
      );

      batch = [];

      console.log(
        `Location Jump: ${fraudInserted.toLocaleString()} fraud / ${FRAUD_PER_TYPE.toLocaleString()}`,
      );
    }
  }

  if (
    batch.length > 0
  ) {
    await insertBatch(
      batch,
      accountMap,
    );
  }

  console.log(
    `Location history inserted: ${historyInserted.toLocaleString()}`,
  );
}

/**
 * ============================================================
 * GENERATE SLEEP AND WAKE
 * ============================================================
 */

async function generateSleepWakeFraud(
  accounts: Account[],
  accountMap: Map<
    string,
    Account
  >,
) {
  console.log(
    "Generating Sleep and Wake fraud...",
  );

  const GROUP_SIZE = 4;

  const GROUP_COUNT =
    FRAUD_PER_TYPE /
    GROUP_SIZE;

  let inserted = 0;

  let batch: any[] = [];

  let attempts = 0;

  for (
    let i = 0;
    i < GROUP_COUNT;
    i++
  ) {
    let group = null;

    while (
      !group
    ) {
      attempts++;

      if (
        attempts >
        1_000_000
      ) {
        throw new Error(
          "Could not generate Sleep and Wake group",
        );
      }

      group =
        generateSleepWakeGroup(
          accounts,
        );
    }

    batch.push(
      ...group,
    );

    inserted +=
      group.length;

    if (
      batch.length >=
      BATCH_SIZE
    ) {
      await insertBatch(
        batch,
        accountMap,
      );

      batch = [];

      console.log(
        `Sleep and Wake: ${inserted.toLocaleString()} / ${FRAUD_PER_TYPE.toLocaleString()}`,
      );
    }
  }

  if (
    batch.length > 0
  ) {
    await insertBatch(
      batch,
      accountMap,
    );
  }
}

/**
 * ============================================================
 * VALIDATE FINAL COUNTS
 * ============================================================
 */

async function validateFinalCounts() {
  console.log(
    "Validating final database counts...",
  );

  const total =
    await prisma.transaction.count();

  const fraud =
    await prisma.transaction.count({
      where: {
        isFraud: true,
      },
    });

  const normal =
    await prisma.transaction.count({
      where: {
        isFraud: false,
      },
    });

  console.log(
    "\n========================================",
  );

  console.log(
    "FINAL DATASET",
  );

  console.log(
    "========================================",
  );

  console.log(
    `Total: ${total.toLocaleString()}`,
  );

  console.log(
    `Fraud: ${fraud.toLocaleString()}`,
  );

  console.log(
    `Normal: ${normal.toLocaleString()}`,
  );

  console.log(
    `Fraud percentage: ${(
      (fraud / total) *
      100
    ).toFixed(2)}%`,
  );

  console.log(
    "========================================",
  );

  if (
    total !==
    TOTAL_TRANSACTIONS
  ) {
    throw new Error(
      `Expected ${TOTAL_TRANSACTIONS} transactions but got ${total}`,
    );
  }

  if (
    fraud !==
    TOTAL_FRAUD_TRANSACTIONS
  ) {
    throw new Error(
      `Expected ${TOTAL_FRAUD_TRANSACTIONS} fraud transactions but got ${fraud}`,
    );
  }

  if (
    normal !==
    TOTAL_NORMAL_TRANSACTIONS
  ) {
    throw new Error(
      `Expected ${TOTAL_NORMAL_TRANSACTIONS} normal transactions but got ${normal}`,
    );
  }

  console.log(
    "Final counts are correct.",
  );
}

/**
 * ============================================================
 * MAIN
 * ============================================================
 */

async function shouldSkipSeeding() {
  const existingTransactions =
    await prisma.transaction.count();

  const existingUsers =
    await prisma.user.count({
      where: {
        email: {
          startsWith:
            "testuser",
        },
      },
    });

  const existingBankAccounts =
    await prisma.bankAccount.count();

  const isSeeded =
    existingTransactions >=
      TOTAL_TRANSACTIONS &&
    existingUsers >= TOTAL_USERS &&
    existingBankAccounts >=
      TOTAL_USERS;

  if (isSeeded) {
    console.log(
      `Seed data already exists (${existingTransactions.toLocaleString()} transactions, ${existingUsers.toLocaleString()} test users, ${existingBankAccounts.toLocaleString()} bank accounts). Skipping seeding.`,
    );

    return true;
  }

  if (
    existingTransactions > 0 ||
    existingUsers > 0 ||
    existingBankAccounts > 0
  ) {
    console.log(
      `Existing seed data detected (${existingTransactions.toLocaleString()} transactions, ${existingUsers.toLocaleString()} test users, ${existingBankAccounts.toLocaleString()} bank accounts). Continuing to populate.`,
    );
  }

  return false;
}

async function main() {
  console.log(
    "Starting large fraud dataset generation...",
  );

  console.log(
    `Total transactions: ${TOTAL_TRANSACTIONS.toLocaleString()}`,
  );

  console.log(
    `Fraud transactions: ${TOTAL_FRAUD_TRANSACTIONS.toLocaleString()}`,
  );

  console.log(
    `Normal transactions: ${TOTAL_NORMAL_TRANSACTIONS.toLocaleString()}`,
  );

  const shouldSkip =
    await shouldSkipSeeding();

  if (shouldSkip) {
    return;
  }

  /**
   * ----------------------------------------------------------
   * CLEAN OLD DATA
   * ----------------------------------------------------------
   */

  console.log(
    "Deleting old transactions...",
  );

  await prisma.transaction.deleteMany();

  console.log(
    "Deleting old bank accounts...",
  );

  await prisma.bankAccount.deleteMany();

  console.log(
    "Deleting old test users...",
  );

  await prisma.user.deleteMany({
    where: {
      email: {
        startsWith:
          "testuser",
      },
    },
  });

  /**
   * ----------------------------------------------------------
   * CREATE USERS
   * ----------------------------------------------------------
   */

  const users =
    await createUsers();

  /**
   * ----------------------------------------------------------
   * CREATE BANK ACCOUNTS
   * ----------------------------------------------------------
   */

  const accounts =
    await createBankAccounts(
      users,
    );

  const accountMap =
    new Map(
      accounts.map(
        (account) => [
          account.id,
          account,
        ],
      ),
    );

  /**
   * ----------------------------------------------------------
   * GENERATE NORMAL
   * ----------------------------------------------------------
   */

  await generateNormalTransactions(
    accounts,
    accountMap,
  );

  /**
   * ----------------------------------------------------------
   * GENERATE IMMEDIATE LARGE
   * ----------------------------------------------------------
   */

  await generateImmediateFraud(
    accounts,
    accountMap,
  );

  /**
   * ----------------------------------------------------------
   * GENERATE MANY-TO-ONE
   * ----------------------------------------------------------
   */

  await generateManyToOneFraud(
    accounts,
    accountMap,
  );

  /**
   * ----------------------------------------------------------
   * GENERATE SAME AMOUNT
   * ----------------------------------------------------------
   */

  await generateSameAmountFraud(
    accounts,
    accountMap,
  );

  /**
   * ----------------------------------------------------------
   * GENERATE VELOCITY
   * ----------------------------------------------------------
   */

  await generateVelocityFraud(
    accounts,
    accountMap,
  );

  /**
   * ----------------------------------------------------------
   * GENERATE LOCATION JUMP
   * ----------------------------------------------------------
   */

  await generateLocationJumpFraud(
    accounts,
    accountMap,
  );

  /**
   * ----------------------------------------------------------
   * GENERATE SLEEP AND WAKE
   * ----------------------------------------------------------
   */

  await generateSleepWakeFraud(
    accounts,
    accountMap,
  );

  /**
   * ----------------------------------------------------------
   * FINAL VALIDATION
   * ----------------------------------------------------------
   */

  await validateFinalCounts();

  console.log(
    "\nDataset generation completed successfully.",
  );
}

main()
  .catch((error) => {
    console.error(
      "\nDataset generation failed:\n",
      error,
    );

    process.exit(1);
  })
  .finally(
    async () => {
      await prisma.$disconnect();
    },
  );