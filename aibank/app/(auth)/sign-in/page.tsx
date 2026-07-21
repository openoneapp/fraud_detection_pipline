"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { BankIcon } from "@hugeicons/core-free-icons"
import { SignInForm } from "@/components/auth/sign-in-form";

export default function SignInPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <a href="#" className="flex items-center gap-2 self-center font-medium">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <HugeiconsIcon icon={BankIcon} strokeWidth={2} className="size-4" />
          </div>
          AI BANK
        </a>
        <SignInForm />
      </div>
    </div>
  );
}
