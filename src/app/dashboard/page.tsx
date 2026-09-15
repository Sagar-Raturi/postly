import type { Metadata } from "next";
import { PostList } from "@/components/dashboard/post-list";

export const metadata: Metadata = {
  title: "Posts — Postly",
};

export default function DashboardPage() {
  return <PostList />;
}
