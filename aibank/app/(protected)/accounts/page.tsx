"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Wallet,
  PiggyBank,
  CreditCard,
  Landmark,
  Search,
  Plus,
  MoreVertical,
  Eye,
  EyeOff,
  ArrowUpRight,
  ArrowDownLeft,
  Ban,
  Loader2,
} from "lucide-react";
import { createBankAccount, getBankAccounts } from "@/server/BankAccounts";
import { BankAccount, BankAccountRequest } from "@/server/BankAccounts/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import z from "zod";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";

const TYPE_META = {
  SAVINGS: { label: "Savings", icon: PiggyBank },
  CHECKING: { label: "Checking", icon: Wallet },
  CREDIT: { label: "Credit", icon: CreditCard },
  LOAN: { label: "Landmark", icon: Landmark },
};

const STATUS_META = {
  ACTIVE: {
    label: "Active",
    className: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  },
  SUSPENDED: {
    label: "Suspended",
    className: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  },
  CLOSED: {
    label: "Closed",
    className: "bg-slate-200 text-slate-600 hover:bg-slate-200",
  },
};

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}

function maskAccountNumber(accountNumber: string, revealed: boolean) {
  if (revealed) return accountNumber;
  return "•••• " + accountNumber.slice(-4);
}

interface AccountCardProps {
  account: BankAccount;
  revealed: boolean;
  onToggleReveal: (id: string) => void;
}

function AccountCard({ account, revealed, onToggleReveal }: AccountCardProps) {
  const type = TYPE_META[account.accountType as keyof typeof TYPE_META];
  const status = STATUS_META[account.status as keyof typeof STATUS_META];
  const Icon = type.icon;
  const isNegative = account.balance < 0;

  return (
    <Card className="flex flex-col shadow-lg bg-cyan-600 text-white border-none pb-0">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div className="flex items-start gap-3 min-w-0">
          {/* Icon container: Swapped bg-muted for a soft glass effect */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            {/* Title: Pure crisp white */}
            <CardTitle className="truncate text-base font-semibold text-white">
              {account.accountName}
            </CardTitle>
            {/* Description: Semi-transparent white for visual hierarchy */}
            <CardDescription className="flex items-center gap-1.5 truncate text-white/75">
              <span className="font-mono text-sm">
                {maskAccountNumber(account.accountNumber, revealed)}
              </span>
              <button
                type="button"
                onClick={() => onToggleReveal(account.id)}
                className="text-white/60 hover:text-white transition-colors"
                aria-label={
                  revealed ? "Hide account number" : "Show account number"
                }
              >
                {revealed ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </button>
            </CardDescription>
          </div>
        </div>

        {/* Dropdown Action: White/transparent hover states */}
        <DropdownMenu>
          <DropdownMenuTrigger>
            <div className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent">
              <MoreVertical className="h-4 w-4" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>View details</DropdownMenuItem>
            <DropdownMenuItem>View transactions</DropdownMenuItem>
            <DropdownMenuItem>Edit account</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">
              <Ban className="mr-2 h-4 w-4" />
              Suspend account
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent className="flex-1 py-2">
        {/* Balance text: Adapts gracefully if negative, otherwise clean white */}
        <p
          className={`text-2xl font-bold tracking-tight break-all sm:text-3xl ${
            isNegative ? "text-red-200" : "text-white"
          }`}
        >
          {formatCurrency(account.balance, account.currency)}
        </p>
        <p className="mt-1 text-xs text-cyan-100/70">
          Opened{" "}
          {new Date(account.createdAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </p>
      </CardContent>

      {/* Footer: Swapped border-t for a subtle white stroke opacity */}
      <CardFooter className="bg-cyan-100/10 pb-4 h-full flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4">
        <div className="flex flex-wrap gap-2">
          {/* Badges: Styled with glass/white backgrounds to stay readable */}
          <Badge className="bg-white/15 text-white hover:bg-white/25 border-none">
            {type.label}
          </Badge>
          <Badge className={`${status.className} border-none`}>
            {status.label}
          </Badge>
        </div>
        <div className="flex gap-1.5">
          {/* Action Buttons: Clean border-white/20 with white text */}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
            aria-label="Send money"
          >
            <ArrowUpRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
            aria-label="Receive money"
          >
            <ArrowDownLeft className="h-4 w-4" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

function SummaryCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string | null;
}) {
  return (
    <Card className="shadow bg-slate-50">
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-xl font-semibold tracking-tight sm:text-2xl">
          {value}
        </p>
        {sub ? (
          <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

// Form Validation Schema matching BankAccountRequest structure
const formSchema = z.object({
  accountName: z.string().min(1, "Account name is required"),
  accountType: z.enum(["SAVINGS", "CHECKING", "CREDIT", "LOAN"]),
  balance: z.number(),
});

type FormValues = z.infer<typeof formSchema>;

interface DialogFormProps {
  submit: (data: BankAccountRequest) => Promise<void>;
}

function DialogForm({ submit }: DialogFormProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      accountName: "",
      accountType: "SAVINGS",
      balance: 0,
    },
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset fields when the modal opens or closes
  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  if (!mounted) {
    return (
      <Button className="w-full sm:w-auto" disabled>
        <Plus className="mr-2 h-4 w-4" />
        Add account
      </Button>
    );
  }

  const onSubmit = async (values: FormValues) => {
    try {
      await submit(values);
      setOpen(false);
    } catch (err) {
      console.error("Submission failed:", err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2 w-full sm:w-auto">
        <Plus className="mr-2 h-4 w-4" />
        Add account
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Account</DialogTitle>
          <DialogDescription>
            Fill out the details below to open a new account dashboard module.
          </DialogDescription>
        </DialogHeader>

        <form id="form-rhf-demo" onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            {/* ACCOUNT NAME */}
            <Controller
              name="accountName"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="account-name">Account Name</FieldLabel>
                  <Input
                    {...field}
                    id="account-name"
                    aria-invalid={fieldState.invalid}
                    placeholder="e.g., Main Checking"
                    autoComplete="off"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            {/* ACCOUNT TYPE */}
            <Controller
              name="accountType"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="account-type">Account Type</FieldLabel>
                  {/* Replace this with your UI library's standard <Select> or <select> tag */}
                  <select
                    {...field}
                    id="account-type"
                    aria-invalid={fieldState.invalid}
                    className="w-full rounded-md border p-2 bg-transparent" // Adjust classes based on your design system
                  >
                    <option value="" disabled>
                      Select an account type
                    </option>
                    <option value="SAVINGS">Savings</option>
                    <option value="CHECKING">Checking</option>
                    <option value="CREDIT">Credit</option>
                    <option value="LOAN">Loan</option>
                  </select>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            {/* BALANCE */}
            <Controller
              name="balance"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="balance">Starting Balance</FieldLabel>
                  <Input
                    {...field}
                    value={field.value}
                    id="balance"
                    type="number"
                    step="0.01" // Allows decimals for cents/currency
                    aria-invalid={fieldState.invalid}
                    placeholder="0.00"
                    // Ensure values map cleanly back to react-hook-form as numbers/empty strings
                    onChange={(e) => {
                      const value = e.target.value;
                      field.onChange(value === "" ? "" : parseFloat(value));
                    }}
                  />
                  <FieldDescription>
                    {" "}
                    Enter a starting amount equal to or greater than 0.{" "}
                  </FieldDescription>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </FieldGroup>
          <Button type="submit">Submit</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function BankAccountDashboard() {
  const [mounted, setMounted] = useState(false);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const result = await getBankAccounts();

        if (result.success && result.data) {
          setBankAccounts(result.data);
        } else {
          setError(result.error || "Failed to load accounts.");
        }
      } catch (err) {
        setError("An unexpected network error occurred.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const handleCreateAccount = async (data: BankAccountRequest) => {
    try {
      const res = await createBankAccount(data);

      if (res.success) {
        const updatedList = await getBankAccounts();
        if (updatedList.success && updatedList.data) {
          setBankAccounts(updatedList.data);
        }
      }
    } catch (err) {
      console.error("Failed to create bank account:", err);
    }
  };

  const toggleReveal = (id: string) =>
    setRevealedIds((prev) => ({ ...prev, [id]: !prev[id] }));

  const filteredAccounts = useMemo(() => {
    return bankAccounts.filter((a) => {
      const matchesSearch =
        a.accountName.toLowerCase().includes(search.toLowerCase()) ||
        a.accountNumber.includes(search);
      const matchesType = typeFilter === "ALL" || a.accountType === typeFilter;
      const matchesStatus = statusFilter === "ALL" || a.status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [bankAccounts, search, typeFilter, statusFilter]);

  const totalBalance = bankAccounts
    .filter((a) => a.balance > 0)
    .reduce((sum, a) => sum + a.balance, 0);
  const totalLiabilities = bankAccounts
    .filter((a) => a.balance < 0)
    .reduce((sum, a) => sum + Math.abs(a.balance), 0);
  const activeCount = bankAccounts.filter((a) => a.status === "ACTIVE").length;

  if (!mounted) {
    return <div className="placeholder" />;
  }

  return (
    <div className="bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Bank Accounts
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage and monitor all accounts linked to your profile.
            </p>
          </div>
          <DialogForm submit={handleCreateAccount} />
        </div>

        {/* Summary Sections */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Total balance"
            value={formatCurrency(totalBalance, "USD")}
            sub="Across savings & checking"
          />
          <SummaryCard
            label="Total liabilities"
            value={formatCurrency(totalLiabilities, "USD")}
            sub="Credit & loan accounts"
          />
          <SummaryCard
            label="Active accounts"
            value={activeCount}
            sub={`of ${bankAccounts.length} total`}
          />
          <SummaryCard
            label="Accounts shown"
            value={filteredAccounts.length}
            sub="Matching current filters"
          />
        </div>

        <Separator className="my-6" />

        {/* Filters Layout */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or account number"
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex sm:w-auto">
            <Select
              value={typeFilter}
              onValueChange={(val) => setTypeFilter(val ?? "ALL")}
            >
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Account type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All types</SelectItem>
                <SelectItem value="SAVINGS">Savings</SelectItem>
                <SelectItem value="CHECKING">Checking</SelectItem>
                <SelectItem value="CREDIT">Credit</SelectItem>
                <SelectItem value="LOAN">Loan</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={statusFilter}
              onValueChange={(val) => setStatusFilter(val ?? "ALL")}
            >
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="SUSPENDED">Suspended</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Content Handler */}
        {loading ? (
          <div className="mt-12 flex flex-col items-center justify-center gap-2 py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Fetching accounts...
            </p>
          </div>
        ) : error ? (
          <div className="mt-12 rounded-lg border border-destructive/50 bg-destructive/5 p-6 text-center">
            <p className="text-sm font-medium text-destructive">
              Error loading accounts
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredAccounts.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  revealed={!!revealedIds[account.id]}
                  onToggleReveal={toggleReveal}
                />
              ))}
            </div>

            {filteredAccounts.length === 0 && (
              <div className="mt-6 flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
                <p className="text-sm font-medium">No accounts found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try adjusting your search or filters.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
