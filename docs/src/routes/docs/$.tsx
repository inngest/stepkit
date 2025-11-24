import { createFileRoute, notFound } from '@tanstack/react-router';
import { DocsLayout } from 'fumadocs-ui/layouts/notebook';
import { createServerFn } from '@tanstack/react-start';
import { source } from '@/lib/source';
import type * as PageTree from 'fumadocs-core/page-tree';
import { ReactNode, useMemo } from 'react';
import { docs } from '@/.source';
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from 'fumadocs-ui/page';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { createClientLoader } from 'fumadocs-mdx/runtime/vite';
import { baseOptions } from '@/lib/layout.shared';
import 'katex/dist/katex.min.css';
import { SectionSwitcher } from '@/components/section-switcher';
import { useSectionStore } from '@/lib/store';

export const Route = createFileRoute('/docs/$')({
  component: Page,
  loader: async ({ params }) => {
    const slugs = params._splat?.split('/') ?? [];
    const data = await loader({ data: slugs });
    await clientLoader.preload(data.path);
    return data;
  },
});

const loader = createServerFn({
  method: 'GET',
})
  .inputValidator((slugs: string[]) => slugs)
  .handler(async ({ data: slugs }) => {
    const page = source.getPage(slugs);
    if (!page) throw notFound();

    return {
      tree: source.pageTree as object,
      path: page.path,
    };
  });

const clientLoader = createClientLoader(docs.doc, {
  id: 'docs',
  component({ toc, frontmatter, default: MDX }: any) {
    return (
      <DocsPage tableOfContent={{
        style: 'clerk',
      }} toc={toc}>
        <DocsTitle>{frontmatter.title}</DocsTitle>
        <DocsDescription>{frontmatter.description}</DocsDescription>
        <DocsBody>
          <MDX
            components={{
              ...defaultMdxComponents,
            }}
          />
        </DocsBody>
      </DocsPage>
    );
  },
});

function Page() {
  const data = Route.useLoaderData();
  const section = useSectionStore((state) => state.section);
  const Content = clientLoader.getComponent(data.path);
  const { nav, ...base } = baseOptions();

  const tree = useMemo(
    () => transformPageTree(data.tree as PageTree.Folder),
    [data.tree],
  );

  // Filter tree to only show the selected section (learn or reference)
  const filteredTree = useMemo(() => {
    if (!tree || !section) return tree;
    
    // Find the selected section folder (e.g., "learn" or "reference")
    const selectedFolder = tree.children.find((node) => {
      if (node.type === 'folder') {
        return (node.name as string)?.toLowerCase() === section.toLowerCase();
      }
      return false;
    }) as PageTree.Folder | undefined;

    // Unwrap the folder's children to avoid tabs, but keep full nested structure
    if (selectedFolder && selectedFolder.type === 'folder') {
      return {
        ...tree,
        children: selectedFolder.children || [],
      };
    }

    // Fallback to empty if section not found
    return {
      ...tree,
      children: [],
    };
  }, [tree, section]);


  return (
    <DocsLayout 
      key={section}
      {...base}
      nav={{ ...nav, mode: 'top' }}
      tree={filteredTree}
      sidebar={{
        banner: <SectionSwitcher />,
      }}
    >
      <Content />
    </DocsLayout>
  );
}

function transformPageTree(root: PageTree.Root): PageTree.Root {
  function mapNode<T extends PageTree.Node>(item: T): T {
    if (typeof item.icon === 'string') {
      item = {
        ...item,
        icon: (
          <span
            dangerouslySetInnerHTML={{
              __html: item.icon,
            }}
          />
        ),
      };
    }

    if (item.type === 'folder') {
      return {
        ...item,
        index: item.index ? mapNode(item.index) : undefined,
        children: item.children.map(mapNode),
      };
    }

    return item;
  }

  return {
    ...root,
    children: root.children.map(mapNode),
    fallback: root.fallback ? transformPageTree(root.fallback) : undefined,
  };
}
