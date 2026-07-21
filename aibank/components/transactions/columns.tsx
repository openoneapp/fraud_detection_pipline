"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { MapPin, ArrowRight, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { format } from "date-fns";

export type TransactionWithAccounts = {
  id: string;
  amount: string;
  currency: string;
  reference: string | null;
  description: string | null;
  latitude: string | null;
  longitude: string | null;
  createdAt: Date;
  senderAccount?: { id: string; accountName?: string | null; accountNumber?: string | null } | null;
  receiverAccount: { id: string; accountName?: string | null; accountNumber?: string | null };
};

declare module "@tanstack/table-core" {
  interface TableMeta<TData> {
    ownAccountIds?: string[];
  }
}

export const columns: ColumnDef<TransactionWithAccounts>[] = [
  {
    accessorKey: "createdAt",
    header: "Date",
    cell: ({ row }) => format(new Date(row.getValue("createdAt")), "MMM dd, yyyy HH:mm"),
  },
  {
    accessorKey: "flow",
    header: "Account Flow",
    cell: ({ row }) => {
      const sender = row.original.senderAccount?.accountName || row.original.senderAccount?.accountNumber || "External / Top-up";
      const receiver = row.original.receiverAccount.accountName || row.original.receiverAccount.accountNumber || row.original.receiverAccount.id;
      return (
        <div className="flex items-center space-x-2 max-w-[250px] truncate text-sm">
          <span className="font-mono text-muted-foreground truncate">{sender.substring(0, 8)}</span>
          <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="font-mono font-medium truncate">{receiver.substring(0, 8)}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "reference",
    header: "Reference",
    cell: ({ row }) => {
      const ref = row.getValue("reference") as string;
      return ref ? <Badge variant="outline" className="font-mono">{ref}</Badge> : <span className="text-muted-foreground text-xs">—</span>;
    },
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => <span className="max-w-[200px] truncate block">{row.getValue("description") || "No description"}</span>,
  },
  {
    accessorKey: "location",
    header: "Location",
    cell: ({ row }) => {
      const lat = row.original.latitude;
      const lon = row.original.longitude;
      if (!lat || !lon) return <span className="text-muted-foreground text-xs">—</span>;
      return (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
          <MapPin className="h-3 w-3" />
          {parseFloat(lat).toFixed(3)}, {parseFloat(lon).toFixed(3)}
        </span>
      );
    },
  },
  {
    accessorKey: "amount",
    header: () => <div className="text-right">Amount</div>,
    cell: ({ row, table }) => {
      const amount = parseFloat(row.getValue("amount"));
      const currency = row.original.currency;
      const senderId = row.original.senderAccount?.id;
      const receiverId = row.original.receiverAccount.id;
      
      // Grab our user's account IDs array from the table meta
      const ownAccountIds = table.options.meta?.ownAccountIds || [];

      // Determine debit or credit:
      // If the sender account is one of the user's own accounts, money is leaving (Debit).
      // Otherwise, if the receiver is theirs or there's no sender, it's incoming (Credit).
      const isSenderOwnAccount = senderId ? ownAccountIds.includes(senderId) : false;
      const isReceiverOwnAccount = ownAccountIds.includes(receiverId);

      let isDebit = false;
      
      if (isSenderOwnAccount && isReceiverOwnAccount) {
        // Internal transfer between own accounts: You can choose to show it as neutral 
        // or treat it as a debit from the sender's perspective. Let's default to debiting the sender.
        isDebit = true; 
      } else if (isSenderOwnAccount) {
        isDebit = true; // Sent to an external account
      } else {
        isDebit = false; // Received from external / top-up
      }

      const formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency,
      }).format(amount);

      return (
        <div className={`flex items-center justify-end gap-1 text-right font-bold tracking-tight ${
          isDebit ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
        }`}>
          <span>{isDebit ? `-${formatted}` : `+${formatted}`}</span>
          {isDebit ? (
            <ArrowUpRight className="h-4 w-4 shrink-0" />
          ) : (
            <ArrowDownLeft className="h-4 w-4 shrink-0" />
          )}
        </div>
      );
    },
  },
];