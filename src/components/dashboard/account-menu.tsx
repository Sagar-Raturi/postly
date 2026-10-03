"use client";

import * as React from "react";
import { ChevronDown, LogOut } from "lucide-react";
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
  const [failed, setFailed] = React.useState(false);

  if (!user) return null;

  async function handleLogout() {
    if (signingOut) return;
    setSigningOut(true);
    setFailed(false);
    try {
      await logout();
      // Success leaves the page, so there is nothing to reset here.
    } catch {
      // Still signed in, on the server and so here. Say so, and let them
      // try again rather than pretending.
      setFailed(true);
      setSigningOut(false);
    }
  }

  return (
    <DropdownMenu
      // The failure note lives in the menu, so it is gone the next time the
      // menu opens and the attempt is fresh.
      onOpenChange={(open) => {
        if (open) setFailed(false);
      }}
    >
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

        {/*
          Subscribers and Settings used to be listed here, which made an
          account menu the only way to find two screens that have nothing
          to do with the account. They are in the dashboard nav now, so
          this menu is back to being about who is signed in.
        */}
        <DropdownMenuItem
          // Kept open while it works, so "Signing out…" and a failure are
          // seen rather than happening behind a closed menu.
          closeOnClick={false}
          onClick={handleLogout}
          disabled={signingOut}
        >
          <LogOut aria-hidden />
          {signingOut ? "Signing out…" : failed ? "Try again" : "Log out"}
        </DropdownMenuItem>
        {failed ? (
          <p role="alert" className="px-2 pt-1 pb-2 text-[0.75rem] leading-snug text-destructive">
            Couldn&apos;t reach the server to sign you out. You&apos;re still
            signed in.
          </p>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
