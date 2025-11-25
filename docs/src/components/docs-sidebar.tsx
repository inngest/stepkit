import { Link } from '@tanstack/react-router';
import type * as PageTree from 'fumadocs-core/page-tree';
import { useSectionStore } from '@/lib/store';
import { SectionSwitcher } from '@/components/section-switcher';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

interface DocsSidebarProps extends React.ComponentProps<typeof Sidebar> {
  tree: PageTree.Root;
  currentPath?: string;
}

export function DocsSidebar({ tree, currentPath, ...props }: DocsSidebarProps) {
  const section = useSectionStore((state) => state.section);

  // Filter tree based on selected section
  const filteredTree = (() => {
    if (!tree || !section) return tree;
    
    const selectedFolder = tree.children.find((node) => {
      if (node.type === 'folder') {
        return (node.name as string)?.toLowerCase() === section.toLowerCase();
      }
      return false;
    }) as PageTree.Folder | undefined;

    if (selectedFolder && selectedFolder.type === 'folder') {
      return {
        ...tree,
        children: selectedFolder.children || [],
      };
    }

    return {
      ...tree,
      children: [],
    };
  })();

  const renderNode = (node: PageTree.Node) => {
    if (node.type === 'page') {
      const isActive = currentPath === node.url;
      
      return (
        <SidebarMenuItem key={node.url}>
          <SidebarMenuButton
            asChild
            isActive={isActive}
            className="data-[active=true]:bg-accent data-[active=true]:border-accent relative h-[30px] w-fit overflow-visible border border-transparent text-[0.8rem] font-medium"
          >
            <a href={node.url}>
              {node.name}
            </a>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    }

    if (node.type === 'folder') {
      return (
        <SidebarGroup key={node.name}>
          <SidebarGroupLabel className="text-muted-foreground font-medium">
            {node.name}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {node.children.map((child) => renderNode(child))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      );
    }

    return null;
  };

  return (
    <Sidebar
      className="sticky top-0 z-30 hidden h-screen overscroll-none bg-transparent lg:flex"
      collapsible="none"
      {...props}
    >
      <SidebarContent className="no-scrollbar overflow-x-hidden px-2">
        {/* Sticky section switcher */}
        <div className="sticky top-0 z-10 py-4 bg-background">
          <SectionSwitcher />
        </div>

        {/* Render filtered tree */}
        {filteredTree.children.map((node) => renderNode(node))}
      </SidebarContent>
    </Sidebar>
  );
}

