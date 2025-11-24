import type * as PageTree from 'fumadocs-core/page-tree';
import { DocsPage } from '@/components/docs-page';
import type { TocItem } from '@/components/docs-toc';
import defaultMdxComponents from 'fumadocs-ui/mdx';

interface DocsContentWrapperProps {
  MDX: any;
  toc?: TocItem[];
  frontmatter: {
    title: string;
    description?: string;
  };
  tree: PageTree.Root;
  currentUrl: string;
}

export function DocsContentWrapper({
  MDX,
  toc,
  frontmatter,
  tree,
  currentUrl,
}: DocsContentWrapperProps) {
  return (
    <DocsPage
      title={frontmatter.title}
      description={frontmatter.description}
      toc={toc}
      tree={tree}
      currentUrl={currentUrl}
    >
      <MDX components={{ ...defaultMdxComponents }} />
    </DocsPage>
  );
}

