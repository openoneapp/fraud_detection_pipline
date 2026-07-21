import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getBankAccountsTransfer } from "@/server/BankAccounts";
import { getTransactionData } from "@/server/Transactions";
import { ArrowUpRight, ArrowDownLeft, Wallet } from "lucide-react";
import { Suspense } from "react";
import { TransactionTable } from "@/components/transactions/TransactionTable";
import { TransferActionTrigger } from "@/components/transactions/TransferActionTrigger";

type TransactionsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TransactionsDashboard({
  searchParams,
}: TransactionsPageProps) {
  const resolvedSearchParams = searchParams
    ? await Promise.resolve(searchParams)
    : {};
  const rawPage = resolvedSearchParams.page;
  const currentPage = Number(Array.isArray(rawPage) ? rawPage[0] : rawPage) || 1;

  const { data } = await getTransactionData({ page: currentPage, limit: 10 });
  const resAccounts = await getBankAccountsTransfer();

  const transactions = data?.transactions ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalVolume = data?.totalVolume ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const hasPrevPage = data?.hasPrevPage ?? false;
  const hasNextPage = data?.hasNextPage ?? false;

  const accounts = resAccounts?.data ?? { source: [], destination: [] };

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Transactions
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage and monitor all your transactions.
          </p>
        </div>
        <Suspense>
          <TransferActionTrigger accounts={accounts} />
        </Suspense>
      </div>

      {/* Top Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-slate-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalVolume}</div>
            <p className="text-xs text-muted-foreground">
              Aggregated from recent activity
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Transactions
            </CardTitle>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{totalCount}</div>
            <p className="text-xs text-muted-foreground">
              Lifetime records processed
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Currencies
            </CardTitle>
            <ArrowDownLeft className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Array.from(new Set(transactions.map((t) => t.currency))).join(
                ", ",
              ) || "None"}
            </div>
            <p className="text-xs text-muted-foreground">
              Detected in recent payloads
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Interactive Table Layout */}
      <div className="hidden h-full flex-1 flex-col space-y-8 md:flex">
        <Suspense>
          <TransactionTable
            data={transactions}
            ownAccounts={accounts.source}
            currentPage={currentPage}
            totalPages={totalPages}
            hasPrevPage={hasPrevPage}
            hasNextPage={hasNextPage}
          />
        </Suspense>
      </div>
    </div>
  );
}
