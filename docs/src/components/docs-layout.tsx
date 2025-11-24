import { DocsSidebar } from '@/components/docs-sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import type * as PageTree from 'fumadocs-core/page-tree';
import { Header } from './header';

interface DocsLayoutProps {
  children: React.ReactNode;
  currentPath?: string;
  FumadocsLayout: React.ComponentType<{ children: React.ReactNode }>;
}

export function DocsLayoutOverride({ children, currentPath, FumadocsLayout }: DocsLayoutProps) {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />

          <FumadocsLayout>
            {children}
          </FumadocsLayout>
    </div>
  );
}
