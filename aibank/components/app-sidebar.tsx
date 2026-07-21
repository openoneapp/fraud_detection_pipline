"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { HugeiconsIcon } from "@hugeicons/react"
import { ChartRingIcon, SentIcon, BankIcon, UserAccountIcon, TransactionHistoryIcon } from "@hugeicons/core-free-icons"
import { createAuthClient } from "better-auth/react"

const data = {
  navMain: [
    {
      title: "Accounts",
      url: "/accounts",
      icon: (
        <HugeiconsIcon icon={UserAccountIcon} strokeWidth={2} />
      ),
      isActive: true
    },
    {
      title: "Transactions",
      url: "/transactions",
      icon: (
        <HugeiconsIcon icon={TransactionHistoryIcon} strokeWidth={2} />
      ),
      isActive: true
    },
    // {
    //   title: "Accounts",
    //   url: "/accounts",
    //   icon: (
    //     <HugeiconsIcon icon={UserAccountIcon} strokeWidth={2} />
    //   ),
    //   isActive: true,
    //   items: [
    //     {
    //       title: "History",
    //       url: "#",
    //     },
    //     {
    //       title: "Starred",
    //       url: "#",
    //     },
    //     {
    //       title: "Settings",
    //       url: "#",
    //     },
    //   ],
    // },
  ],
  navSecondary: [
    {
      title: "Support",
      url: "#",
      icon: (
        <HugeiconsIcon icon={ChartRingIcon} strokeWidth={2} />
      ),
    },
    {
      title: "Feedback",
      url: "#",
      icon: (
        <HugeiconsIcon icon={SentIcon} strokeWidth={2} />
      ),
    },
  ]
}

const { useSession } = createAuthClient()

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: session } = useSession();
  const currentUser = {
    name: session?.user.name || "Quest",
    email: session?.user.email || "Quest@gmail.com",
    avatar: "/avatars/shadcn.jpg",
  };

  return (
    <Sidebar
      className="top-(--header-height) h-[calc(100svh-var(--header-height))]!"
      {...props}
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<a href="#" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <HugeiconsIcon icon={BankIcon} strokeWidth={2} className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">AI Bank</span>
                <span className="truncate text-xs">Enterprise AI</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={currentUser} />
      </SidebarFooter>
    </Sidebar>
  )
}
