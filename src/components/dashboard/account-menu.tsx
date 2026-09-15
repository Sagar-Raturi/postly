"use client";

import * as React from "react";
import Link from "next/link";
import { LogOut, Settings } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/components/auth-provider";

/** First letters of the display name, for the avatar. */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).slice(0, 2);
  return words.map((word) => word[0]?.toUpperCase() ?? "").join("") || "?";
}

export function AccountMenu() {
  const { user, logout } = useAuth();
  const [signingOut, setSigningOut] = React.useState(false);

  if (!user) return null;

  async function handleLogout() {
    if (signingOut) return;
    setSigningOut(true);
    await logout();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-lg"
            className="rounded-full"
            aria-label="Account"
          />
        }
      >
        <Avatar className="size-7">
          <AvatarFallback className="text-[0.7rem] font-medium">
            {initials(user.display_name)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        {/* GroupLabel throws outside a Group — base-ui reads it from context. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <span className="block truncate text-[0.85rem] font-medium">
              {user.display_name}
            </span>
            <span className="block truncate text-[0.75rem] text-muted-foreground">
              {user.email}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem render={<Link href="/dashboard" />}>
          <Settings aria-hidden />
          Dashboard
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleLogout} disabled={signingOut}>
          <LogOut aria-hidden />
          {signingOut ? "Signing out…" : "Log out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
