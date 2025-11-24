import { motion } from 'framer-motion';
import { useSectionStore } from '@/lib/store';

export type Section = 'learn' | 'reference';

export function SectionSwitcher() {
  const section = useSectionStore((state) => state.section);
  const setSection = useSectionStore((state) => state.setSection);

  const handleSwitch = (newSection: Section) => {
    setSection(newSection);
  };

  return (
    <div className="relative inline-flex items-center gap-6 text-sm font-medium">
      <button
        type="button"
        onClick={() => handleSwitch('learn')}
        className={`relative px-3 py-2 transition-colors ${
          section === 'learn'
            ? 'text-fd-foreground'
            : 'text-fd-muted-foreground hover:text-fd-foreground'
        }`}
      >
        Learn
        {section === 'learn' && (
          <motion.div
            className="absolute bottom-0 left-0 right-0 h-0.5 bg-fd-primary"
            layoutId="underline"
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 30,
            }}
          />
        )}
      </button>
      
      <button
        type="button"
        onClick={() => handleSwitch('reference')}
        className={`relative px-3 py-2 transition-colors ${
          section === 'reference'
            ? 'text-fd-foreground'
            : 'text-fd-muted-foreground hover:text-fd-foreground'
        }`}
      >
        Reference
        {section === 'reference' && (
          <motion.div
            className="absolute bottom-0 left-0 right-0 h-0.5 bg-fd-primary"
            layoutId="underline"
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 30,
            }}
          />
        )}
      </button>
    </div>
  );
}

