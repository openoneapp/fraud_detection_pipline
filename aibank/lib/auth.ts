import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { env } from "./env";

// For dev env
// export const auth = betterAuth({
//   database: new Pool({
//     connectionString: process.env.DATABASE_URL,
//   }),
//   advanced: {
//     ipAddress: {
//       disableIpTracking: false, // default — explicit here for clarity
//       ipAddressHeaders: [
//         "x-forwarded-for",     // most common
//         "x-real-ip",
//         "cf-connecting-ip",    // if behind Cloudflare
//         "x-vercel-forwarded-for", // if deployed on Vercel
//       ],
//       trustedProxies: ["10.0.0.0/24"], // your proxy's IP/CIDR
//     },
//   },
//   emailAndPassword: {
//     enabled: true,
//   },
//   secret: process.env.BETTER_AUTH_SECRET,
//   baseURL: process.env.BETTER_AUTH_URL,
// });

// For docker evn
const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

export const auth = betterAuth({
  database: pool,

  advanced: {
    ipAddress: {
      disableIpTracking: false,
      ipAddressHeaders: [
        "x-forwarded-for",
        "x-real-ip",
        "cf-connecting-ip",
        "x-vercel-forwarded-for",
      ],
      trustedProxies: ["10.0.0.0/24"],
    },
  },

  emailAndPassword: {
    enabled: true,
  },

  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
});