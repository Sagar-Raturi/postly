"use client";

import * as React from "react";
import type { Editor } from "@tiptap/react";
import {
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Quote,
} from "lucide-react";
import { cn } from "@/lib/utils";

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // The editor keeps focus, so the selection the command acts on survives.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex size-8 items-center justify-center rounded-md transition-colors",
        "disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4",
        active
          ? "bg-foreground/[0.08] text-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />;
}

export function EditorToolbar({ editor }: { editor: Editor | null }) {
  // TipTap mutates the editor in place, so a re-render has to be forced on
  // every transaction or the active states go stale.
  const [, forceUpdate] = React.useReducer((n: number) => n + 1, 0);

  React.useEffect(() => {
    if (!editor) return;
    editor.on("transaction", forceUpdate);
    return () => {
      editor.off("transaction", forceUpdate);
    };
  }, [editor]);

  if (!editor) return null;

  function setLink() {
    if (!editor) return;
    const existing = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", existing ?? "https://");

    if (url === null) return; // cancelled
    if (url.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url.trim() })
      .run();
  }

  function addImage() {
    if (!editor) return;
    const url = window.prompt("Image URL", "https://");
    if (url === null || url.trim() === "") return;
    editor.chain().focus().setImage({ src: url.trim() }).run();
  }

  return (
    <div className="sticky top-16 z-30 -mx-1 flex flex-wrap items-center gap-0.5 border-b border-border bg-background/90 px-1 py-2 backdrop-blur-md">
      <ToolbarButton
        label="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label="Heading"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        }
      >
        <Heading2 />
      </ToolbarButton>
      <ToolbarButton
        label="Subheading"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 3 }).run()
        }
      >
        <Heading3 />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label="Bullet list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered />
      </ToolbarButton>
      <ToolbarButton
        label="Quote"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote />
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label={editor.isActive("link") ? "Edit link" : "Add link"}
        active={editor.isActive("link")}
        onClick={setLink}
      >
        <Link2 />
      </ToolbarButton>
      {editor.isActive("link") ? (
        <ToolbarButton
          label="Remove link"
          onClick={() =>
            editor.chain().focus().extendMarkRange("link").unsetLink().run()
          }
        >
          <Link2Off />
        </ToolbarButton>
      ) : null}
      <ToolbarButton label="Insert image" onClick={addImage}>
        <ImagePlus />
      </ToolbarButton>
    </div>
  );
}
