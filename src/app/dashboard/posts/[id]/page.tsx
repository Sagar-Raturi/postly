import { notFound } from "next/navigation";
import { PostEditor } from "@/components/dashboard/post-editor";

export const metadata = {
  title: "Editor — Postly",
};

export default async function PostEditorPage({
  params,
}: PageProps<"/dashboard/posts/[id]">) {
  // params is a Promise in Next 16 and has to be awaited.
  const { id } = await params;
  const postId = Number(id);

  if (!Number.isInteger(postId) || postId <= 0) notFound();

  return <PostEditor postId={postId} />;
}
