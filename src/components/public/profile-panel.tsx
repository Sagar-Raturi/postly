import { initials } from "@/lib/initials";

/**
 * Who writes this blog: their picture and their name.
 *
 * A Server Component with no client JavaScript — it is two elements and a
 * string, and a reader should have it in the first byte of HTML like the
 * rest of the page.
 *
 * The image is a plain `<img>` rather than `next/image`. The file lives on
 * the API's origin, which differs per environment and, once Phase 2 moves
 * media to S3, will differ per deployment; `next/image` would need every
 * one of those hosts listed in next.config.ts as a remote pattern before it
 * would render anything at all. The backend has already resized the file to
 * a 512px square, which is the work the loader would otherwise be doing.
 */
export function ProfilePanel({
  name,
  avatar,
}: {
  name: string;
  avatar: string | null;
}) {
  return (
    <div className="flex items-center gap-3">
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatar}
          // Decorative: the name it belongs to is right next to it, so a
          // screen reader announcing both would just say it twice.
          alt=""
          width={40}
          height={40}
          loading="lazy"
          decoding="async"
          className="size-10 shrink-0 rounded-full object-cover ring-1 ring-border"
        />
      ) : (
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-[0.8rem] font-medium text-muted-foreground ring-1 ring-border"
        >
          {initials(name)}
        </span>
      )}

      <span className="font-blog-heading text-[0.95rem] text-foreground">
        {name}
      </span>
    </div>
  );
}
