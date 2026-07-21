"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { HugeiconsIcon } from "@hugeicons/react";
import { LogoutIcon } from "@hugeicons/core-free-icons";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/sign-in");
          router.refresh(); // clears any cached server-rendered session state
        },
      },
    });
  }

  return (
    <button onClick={handleSignOut} className="flex gap-2 items-center">
      <HugeiconsIcon icon={LogoutIcon} strokeWidth={2} />
      Log out
    </button>
  );
}
