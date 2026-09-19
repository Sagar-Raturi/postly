"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, LogOut, Settings, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { initials } from "@/lib/initials";

/**
 * Who is signed in, and the two things they can do about it.
 *
 * The name is shown next to the avatar rather than hidden behind it — on a
 * product where every post carries a byline, it is worth being able to see
 * at a glance which account you are writing as. It folds away below `sm`,
 * where the avatar carries the identity on its own.
 */
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
            className="h-10 gap-2 rounded-full pr-2 pl-1.5"
            aria-label={`Account — ${user.display_name}`}
          />
        }
      >
        <Avatar className="size-7">
          {user.avatar ? <AvatarImage src={user.avatar} alt="" /> : null}
          <AvatarFallback className="bg-brand/12 text-[0.7rem] font-medium text-brand">
            {initials(user.display_name)}
          </AvatarFallback>
        </Avatar>
        <span className="max-w-36 truncate text-[0.85rem] font-medium max-sm:hidden">
          {user.display_name}
        </span>
        <ChevronDown
          aria-hidden
          className="size-3.5 text-muted-foreground max-sm:hidden"
        />
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

        <DropdownMenuItem render={<Link href="/dashboard/subscribers" />}>
          <Users aria-hidden />
          Subscribers
        </DropdownMenuItem>

        <DropdownMenuItem render={<Link href="/dashboard/settings" />}>
          <Settings aria-hidden />
          Settings
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleLogout} disabled={signingOut}>
          <LogOut aria-hidden />
          {signingOut ? "Signing out…" : "Log out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
