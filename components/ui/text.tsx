import { cn } from '@/lib/utils';
import { Slot } from '@rn-primitives/slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Platform, Text as RNText, type Role } from 'react-native';

const textVariants = cva(
  cn(
    'text-foreground text-base',
    Platform.select({
      web: 'select-text',
    })
  ),
  {
    variants: {
      variant: {
        default: '',
        h1: cn(
          'text-center text-4xl font-extrabold tracking-tight',
          Platform.select({ web: 'scroll-m-20 text-balance' })
        ),
        h2: cn(
          'border-border border-b pb-2 text-3xl font-semibold tracking-tight',
          Platform.select({ web: 'scroll-m-20 first:mt-0' })
        ),
        h3: cn('text-2xl font-semibold tracking-tight', Platform.select({ web: 'scroll-m-20' })),
        h4: cn('text-xl font-semibold tracking-tight', Platform.select({ web: 'scroll-m-20' })),
        p: 'mt-3 leading-7 sm:mt-6',
        blockquote: 'mt-4 border-l-2 pl-3 italic sm:mt-6 sm:pl-6',
        code: cn(
          'bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold'
        ),
        lead: 'text-muted-foreground text-xl',
        large: 'text-lg font-semibold',
        small: 'text-sm font-medium leading-none',
        muted: 'text-muted-foreground text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

// Maps a friendly `fontStyle` prop to the Tailwind font-family utility.
// Each key mirrors a family loaded in `app/_layout.tsx` and declared in
// `tailwind.config.ts` (fontFamily), so NativeWind emits `font-<key>` classes.
const fontStyleVariants = cva('', {
  variants: {
    fontStyle: {
      'sf-display-regular': 'font-sf-display-regular',
      'sf-display-medium': 'font-sf-display-medium',
      'sf-display-semibold': 'font-sf-display-semibold',
      'sf-display-light': 'font-sf-display-light',
      'sf-display-bold': 'font-sf-display-bold',
      'sf-display-thin': 'font-sf-display-thin',
      'sf-display-ultra-light': 'font-sf-display-ultra-light',
      'sf-rounded-regular': 'font-sf-rounded-regular',
      'sf-rounded-medium': 'font-sf-rounded-medium',
      'sf-rounded-semibold': 'font-sf-rounded-semibold',
      'sf-rounded-bold': 'font-sf-rounded-bold',
      'sf-rounded-light': 'font-sf-rounded-light',
      'sf-rounded-thin': 'font-sf-rounded-thin',
      'sf-rounded-ultra-light': 'font-sf-rounded-ultra-light',
      'noto-serif-medium': 'font-noto-serif-medium',
      'noto-serif-bold': 'font-noto-serif-bold',
      'noto-serif-semibold': 'font-noto-serif-semibold',
    },
  },
});

type FontStyleVariantProps = VariantProps<typeof fontStyleVariants>;

type TextVariantProps = VariantProps<typeof textVariants>;

type TextVariant = NonNullable<TextVariantProps['variant']>;

const ROLE: Partial<Record<TextVariant, Role>> = {
  h1: 'heading',
  h2: 'heading',
  h3: 'heading',
  h4: 'heading',
  blockquote: Platform.select({ web: 'blockquote' as Role }),
  code: Platform.select({ web: 'code' as Role }),
};

const ARIA_LEVEL: Partial<Record<TextVariant, string>> = {
  h1: '1',
  h2: '2',
  h3: '3',
  h4: '4',
};

const TextClassContext = React.createContext<string | undefined>(undefined);

function Text({
  className,
  asChild = false,
  variant = 'default',
  fontStyle,
  ...props
}: React.ComponentProps<typeof RNText> &
  React.RefAttributes<typeof RNText> &
  TextVariantProps &
  FontStyleVariantProps & {
    asChild?: boolean;
  }) {
  const textClass = React.useContext(TextClassContext);
  const Component = asChild ? Slot : RNText;
  return (
    <Component
      className={cn(
        textVariants({ variant }),
        fontStyleVariants({ fontStyle }),
        textClass,
        className
      )}
      role={variant ? ROLE[variant] : undefined}
      aria-level={variant ? ARIA_LEVEL[variant] : undefined}
      {...props}
    />
  );
}

export { Text, TextClassContext };
