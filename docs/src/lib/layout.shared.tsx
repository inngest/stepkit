import { Header } from '@/components/header';
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: 'StepKit by Inngest',
    },
    links: [
      {
        text: 'Docs',
        url: '/docs',
      },
    ]
  };
}