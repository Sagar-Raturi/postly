import * as React from "react";
import type { Metadata } from "next";
import { PostList } from "@/components/dashboard/post-list";

export const metadata: Metadata = {
  title: "Posts — Postly",
};

export default function DashboardPage() {
  // The list reads `?tab=` to decide which posts to show, which makes it a
  // prerender boundary — see the note in this route's layout.
  return (
    <React.Suspense fallback={null}>
      <PostList />
    </React.Suspense>
  );
}
