import MobileSidebar from '@/components/sidebar/mobile-sidebar';
import Sidebar from '@/components/sidebar/sidebar';
export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId?: string }> | { workspaceId?: string };
}) {
  const resolvedParams =
    (await Promise.resolve(params)) ?? ({} as { workspaceId?: string });
  const workspaceId = resolvedParams?.workspaceId;

  return (
    <main
      className="flex overflow-hidden
      h-screen
      w-screen
  "
    >
      <Sidebar workspaceId={workspaceId} />
      <MobileSidebar>
        <Sidebar
          workspaceId={workspaceId}
          className="w-screen inline-block sm:hidden"
        />
      </MobileSidebar>
      <div
        className="dark:boder-Neutrals-12/70
        border-l-[1px]
        w-full
        relative
        overflow-scroll
      "
      >
        {children}
      </div>
    </main>
  );
}
