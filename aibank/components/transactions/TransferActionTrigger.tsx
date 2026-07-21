// ./TransferActionTrigger.tsx
"use client"; // Marks this block for client handling

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation"; // To refresh server data post-submit
import { TransferDialog } from "./TransactionsForm";
import { BankAccount } from "@/server/BankAccounts/schema";
import { createTransfer } from "@/server/Transactions";
import { createTransferProps } from "@/server/Transactions/schema";

const transferSchema = z.object({
  fromAccountId: z.string().min(1, "Please select a sender account"),
  toAccountId: z.string().min(1, "Please select a receiver account"),
  amount: z.number().positive("Amount must be greater than 0"),
  description: z.string().optional(),
  latitude: z.string(),
  longitude: z.string(),
});

type TransferFormValues = z.infer<typeof transferSchema>;

interface AccountsProps {
  source: BankAccount[];
  destination: BankAccount[];
}

export function TransferActionTrigger({
  accounts,
}: {
  accounts: AccountsProps;
}) {
  const route = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const form = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      fromAccountId: "",
      toAccountId: "",
      amount: 0,
      description: "",
      latitude: "11.5564",
      longitude: "104.9282",
    },
  });

  const handleTransferSubmit = async (values: TransferFormValues) => {
    const value: createTransferProps = {
      amount: values.amount,
      currency: "USD", // Or pass a value if your form tracks currency
      description: values.description,
      latitude: values.latitude,
      longitude: values.longitude,
      senderAccountId: values.fromAccountId,
      receiverAccountId: values.toAccountId,
    };
    const trans = await createTransfer({ value });
    if (trans.status === true) {
      setIsOpen(false);
      route.refresh();
    }
  };

  return (
    <TransferDialog
      accounts={accounts}
      open={isOpen}
      setOpen={setIsOpen}
      onSubmit={handleTransferSubmit}
      form={{
        ...form,
      }}
    />
  );
}
