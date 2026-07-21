import { z } from "zod";

export const Schema = z.object({
  fromAccountId: z.string().min(1, "Please select a sender account"),
  toAccountId: z.string().min(1, "Please select a receiver account"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  description: z.string().optional(),
}).refine((data) => data.fromAccountId !== data.toAccountId, {
  message: "Sender and receiver accounts cannot be the same",
  path: ["toAccountId"], // highlights the receiver dropdown
});

export interface createTransferProps {
  amount: number;
  currency: string;
  reference?: string;
  description?: string;
  latitude?: string;
  longitude?: string;
  senderAccountId: string;
  receiverAccountId: string;
}