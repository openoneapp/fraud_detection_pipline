"use client";

import { Controller } from "react-hook-form";
import { ArrowRightLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "../ui/field";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { BankAccount } from "@/server/BankAccounts/schema";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";
import "leaflet/dist/leaflet.css";
import { AddressLatLong } from "@/lib/addr-lat-long";
import { useState } from "react";
import dynamic from "next/dynamic";

const DebitAddressMap = dynamic(
  () => import("../transactions/DebitAddressMap"),
  {
    ssr: false,
    loading: () => <p>Loading Map...</p>,
  },
);

interface accounts {
  source: BankAccount[];
  destination: BankAccount[];
}

interface TransferFormProps {
  accounts: accounts;
  onSubmit: (data: any) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  form: any;
}

export function TransferDialog({
  accounts,
  open,
  setOpen,
  form,
  onSubmit,
}: TransferFormProps) {
  const [latLong, setLatLong] = useState("");
  const [mapMode, setMapMode] = useState(false);

  // Watch fields in real-time
  const watchFromAccountId = form.watch("fromAccountId");
  const watchToAccountId = form.watch("toAccountId");
  const watchAmount = form.watch("amount") || 0;

  // Dynamic fallbacks matching Cambodia default region
  const watchLatitude = form.watch("latitude") || "11.5564";
  const watchLongitude = form.watch("longitude") || "104.9282";

  // Find the selected account details from your accounts dataset
  const activeSenderAccount = accounts.source.find(
    (acc) => acc.id === watchFromAccountId,
  );
  const activeReceiverAccount = accounts.destination.find(
    (acc) => acc.id === watchToAccountId,
  );

  // Quick runtime guards for disabling the submit action early
  const senderBalance = activeSenderAccount
    ? Number(activeSenderAccount.balance)
    : 0;
  const isInsufficientBalance = Number(watchAmount) > senderBalance;
  const isSameAccount =
    watchFromAccountId &&
    watchToAccountId &&
    watchFromAccountId === watchToAccountId;

  // Submit button blocker
  const isInvalidTransfer =
    isInsufficientBalance ||
    isSameAccount ||
    !watchFromAccountId ||
    !watchToAccountId ||
    Number(watchAmount) <= 0;

  // Handler to parse dropdown changes and inject straight into React Hook Form
  const handleAddressChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setLatLong(value);

    if (value) {
      const [latStr, lngStr] = value.split(",");
      // Even without visible inputs, react-hook-form tracks these values
      form.setValue("latitude", latStr);
      form.setValue("longitude", lngStr);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2 w-full sm:w-auto">
        <ArrowRightLeft className="mr-2 h-4 w-4" />
        Transfer Funds
      </DialogTrigger>

      <DialogContent className={`${mapMode ? "sm:max-w-4xl" : "sm:max-w-sm"}`}>
        <DialogHeader>
          <DialogTitle>Transfer Money</DialogTitle>
          <DialogDescription>
            Move funds instantly between your accounts.
          </DialogDescription>
        </DialogHeader>

        <form id="form-transfer" onSubmit={form.handleSubmit(onSubmit)}>
          <div className={`border-2 rounded-md p-4 ${mapMode ? "grid grid-cols-[1fr_2fr] gap-4 relative" : ""}`}>
            <FieldGroup className="space-y-4">
              {/* FROM ACCOUNT SELECT */}
              <Controller
                name="fromAccountId"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="from-account">
                      Transfer From
                    </FieldLabel>
                    <select
                      {...field}
                      id="from-account"
                      aria-invalid={fieldState.invalid}
                      className="w-full rounded-md border p-2 bg-transparent border-input"
                    >
                      <option value="" disabled>
                        Select source account
                      </option>
                      {accounts.source.map((acc) => (
                        <option
                          key={acc.id}
                          value={acc.id}
                          className={`${acc.balance <= 0 && "text-red-500"}`}
                        >
                          {acc.accountName} (*{acc.accountNumber.slice(-4)})
                        </option>
                      ))}
                    </select>

                    {activeSenderAccount && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Available Balance:{" "}
                        <span className="font-semibold text-foreground">
                          ${senderBalance.toFixed(2)}
                        </span>
                      </p>
                    )}
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              {/* TO ACCOUNT SELECT */}
              <Controller
                name="toAccountId"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid || isSameAccount}>
                    <FieldLabel htmlFor="to-account">Transfer To</FieldLabel>
                    <select
                      {...field}
                      id="to-account"
                      aria-invalid={fieldState.invalid || isSameAccount}
                      className="w-full rounded-md border p-2 bg-transparent border-input"
                    >
                      <option value="" disabled>
                        Select destination account
                      </option>
                      {accounts.destination.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.accountName} (*{acc.accountNumber.slice(-4)})
                        </option>
                      ))}
                    </select>

                    {activeReceiverAccount && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Current Balance: $
                        {Number(activeReceiverAccount.balance).toFixed(2)}
                      </p>
                    )}

                    {isSameAccount && (
                      <p className="text-xs text-destructive mt-1 font-medium">
                        Destination account must be different from the source
                        account.
                      </p>
                    )}
                    {fieldState.invalid && !isSameAccount && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              {/* TRANSFER AMOUNT */}
              <Controller
                name="amount"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field
                    data-invalid={fieldState.invalid || isInsufficientBalance}
                  >
                    <FieldLabel htmlFor="transfer-amount">Amount</FieldLabel>
                    <Input
                      {...field}
                      id="transfer-amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      aria-invalid={fieldState.invalid || isInsufficientBalance}
                      placeholder="0.00"
                      onChange={(e) => {
                        const value = e.target.value;
                        field.onChange(value === "" ? "" : parseFloat(value));
                      }}
                    />

                    {isInsufficientBalance && watchFromAccountId && (
                      <p className="text-xs text-destructive mt-1 font-medium">
                        Insufficient funds. You only have $
                        {senderBalance.toFixed(2)} available.
                      </p>
                    )}
                    {fieldState.invalid && !isInsufficientBalance && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              {/* OPTIONAL DESCRIPTION */}
              <Controller
                name="description"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor="description">
                      Description (Optional)
                    </FieldLabel>
                    <Input
                      {...field}
                      id="description"
                      placeholder="e.g., Rent, Grocery splitting"
                      autoComplete="off"
                    />
                  </Field>
                )}
              />
              <input type="hidden" {...form.register("latitude")} />
              <input type="hidden" {...form.register("longitude")} />
            </FieldGroup>

            <div className={`space-y-4 ${mapMode ? "" : "hidden"}`}>
              <select
                id="address-select"
                value={latLong}
                className="w-full rounded-md border p-2 bg-transparent border-input"
                onChange={handleAddressChange}
              >
                <option value="" disabled>
                  Select address
                </option>
                {AddressLatLong.map((addr) => (
                  <option
                    key={addr.id}
                    value={`${addr.latitude},${addr.longitude}`}
                  >
                    {addr.province}
                  </option>
                ))}
              </select>

              {/* REACTIVE MAP WITH RERENDER KEY PROTECTION */}
              <DebitAddressMap
                key={`${watchLatitude}-${watchLongitude}`}
                lat={Number(watchLatitude)}
                lng={Number(watchLongitude)}
                addressLabel={
                  AddressLatLong.find(
                    (a) => `${a.latitude},${a.longitude}` === latLong,
                  )?.province || "Selected Location"
                }
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 border-2 rounded-md p-2 my-4">
            <Switch
              checked={mapMode}
              onCheckedChange={setMapMode}
            />
            <Label htmlFor="airplane-mode">Enable map select Mode</Label>
          </div>

          <div className="mt-6 flex justify-end">
            <Button type="submit" disabled={isInvalidTransfer}>
              Confirm Transfer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
