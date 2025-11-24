import { create } from 'zustand';
import type { Section } from '@/components/section-switcher';

interface SectionStore {
  section: Section;
  setSection: (section: Section) => void;
}

export const useSectionStore = create<SectionStore>((set) => ({
  section: 'learn',
  setSection: (section) => set({ section }),
}));

