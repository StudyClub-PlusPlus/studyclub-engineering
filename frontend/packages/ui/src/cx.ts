import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Role utilities set size, weight, leading and tracking together. A caller's
// role replaces the component default, just like its previous text-* utility.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          type: [
            'display-lg',
            'display-sm',
            'headline-lg',
            'headline-md',
            'headline-sm',
            'title-lg',
            'title-md',
            'body-lg',
            'body-md',
            'body-sm',
            'label-lg',
            'label-sm',
          ],
        },
      ],
    },
    conflictingClassGroups: {
      'font-size': ['leading', 'font-weight', 'tracking'],
    },
  },
});

export function cx(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
