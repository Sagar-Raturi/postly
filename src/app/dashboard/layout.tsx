export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return <div className="flex min-h-full flex-1 flex-col">{children}</div>;
}
