import * as React from "react"
import { Link } from "@tanstack/react-router"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { findNeighbour } from "fumadocs-core/page-tree"
import type * as PageTree from "fumadocs-core/page-tree"
import { DocsTableOfContents, type TocItem } from "@/components/docs-toc"
import { Button } from "@/components/ui/button"

interface DocsPageProps {
  title: string
  description?: string
  toc?: TocItem[]
  tree: PageTree.Root
  currentUrl: string
  children: React.ReactNode
}

export function DocsPage({
  title,
  description,
  toc,
  tree,
  currentUrl,
  children,
}: DocsPageProps) {
  const neighbours = findNeighbour(tree, currentUrl)

  return (
    <div className="flex items-stretch text-[1.05rem] sm:text-[15px] xl:w-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-1 flex-col gap-8 px-4 py-6 text-foreground md:px-0 lg:py-8">
          {/* Header */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <h1 className="scroll-m-20 text-4xl font-semibold tracking-tight sm:text-3xl xl:text-4xl">
                  {title}
                </h1>
                {/* Mobile navigation */}
                <div className="fixed inset-x-0 bottom-0 isolate z-50 flex items-center gap-2 border-t px-6 py-4 backdrop-blur-sm bg-background/80 border-border/50 sm:static sm:z-0 sm:border-t-0 sm:bg-transparent sm:px-0 sm:pt-1.5 sm:backdrop-blur-none">
                  {neighbours.previous && (
                    <Button
                      variant="secondary"
                      size="icon"
                      className="ml-auto size-8 shadow-none md:size-7"
                      asChild
                    >
                      <a href={neighbours.previous.url}>
                        <ChevronLeft className="h-4 w-4" />
                        <span className="sr-only">Previous</span>
                      </a>
                    </Button>
                  )}
                  {neighbours.next && (
                    <Button
                      variant="secondary"
                      size="icon"
                      className="size-8 shadow-none md:size-7"
                      asChild
                    >
                      <a href={neighbours.next.url}>
                        <span className="sr-only">Next</span>
                        <ChevronRight className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
              {description && (
                <p className="text-muted-foreground text-[1.05rem] text-balance sm:text-base">
                  {description}
                </p>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="w-full flex-1 prose prose-neutral dark:prose-invert max-w-none">
            {children}
          </div>
        </div>

        {/* Desktop navigation */}
        <div className="mx-auto hidden h-16 w-full max-w-3xl items-center gap-2 px-4 sm:flex md:px-0">
          {neighbours.previous && (
            <Button
              variant="secondary"
              size="sm"
              asChild
              className="shadow-none"
            >
              <a href={neighbours.previous.url}>
                <ChevronLeft className="h-4 w-4" /> {neighbours.previous.name}
              </a>
            </Button>
          )}
          {neighbours.next && (
            <Button
              variant="secondary"
              size="sm"
              className="ml-auto shadow-none"
              asChild
            >
              <a href={neighbours.next.url}>
                {neighbours.next.name} <ChevronRight className="h-4 w-4" />
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Table of Contents - Right Sidebar */}
      {toc && toc.length > 0 && (
        <div className="sticky top-0 z-30 ml-auto hidden h-screen w-72 flex-col gap-4 overflow-hidden overscroll-none pb-8 xl:flex">
          <div className="h-16 shrink-0" />
          <div className="no-scrollbar overflow-y-auto px-8">
            <DocsTableOfContents toc={toc} />
            <div className="h-12" />
          </div>
        </div>
      )}
    </div>
  )
}

