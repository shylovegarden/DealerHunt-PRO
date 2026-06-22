/**
 * Centralized design system tokens
 * Use these instead of hardcoded values for consistency
 */

export const spacing = {
  xs: "0.5rem", // 8px
  sm: "0.75rem", // 12px
  md: "1rem", // 16px
  lg: "1.5rem", // 24px
  xl: "2rem", // 32px
  "2xl": "3rem", // 48px
} as const;

export const touchTarget = {
  min: "44px", // WCAG AA minimum
  comfortable: "48px",
  large: "56px",
} as const;

export const borderRadius = {
  sm: "var(--r1)",
  md: "var(--r2)",
  lg: "var(--r3)",
  full: "9999px",
} as const;

export const colors = {
  // Text colors
  text: {
    primary: "var(--t1)",
    secondary: "var(--t2)",
    tertiary: "var(--t3)",
    quaternary: "var(--t4)",
  },
  // Surface colors
  surface: {
    primary: "var(--s1)",
    secondary: "var(--s2)",
    tertiary: "var(--s3)",
  },
  // Border colors
  border: {
    primary: "var(--b1)",
    secondary: "var(--b2)",
  },
  // Semantic colors
  semantic: {
    success: "var(--green)",
    error: "var(--red)",
    warning: "var(--amber)",
    info: "var(--blue)",
  },
  // Brand colors
  brand: {
    primary: "var(--amber)",
    secondary: "var(--blue)",
  },
} as const;

export const typography = {
  heading: {
    h1: "text-2xl md:text-3xl font-black",
    h2: "text-xl md:text-2xl font-black",
    h3: "text-lg md:text-xl font-bold",
    h4: "text-base md:text-lg font-bold",
  },
  body: {
    large: "text-base md:text-lg",
    base: "text-sm md:text-base",
    small: "text-xs md:text-sm",
  },
  label: {
    large: "text-sm font-bold uppercase tracking-wider",
    base: "text-xs font-bold uppercase tracking-widest",
    small: "text-xs uppercase tracking-widest",
  },
} as const;

export const shadows = {
  sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  base: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
  md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
} as const;

export const transitions = {
  fast: "150ms cubic-bezier(0.4, 0, 0.2, 1)",
  base: "200ms cubic-bezier(0.4, 0, 0.2, 1)",
  slow: "300ms cubic-bezier(0.4, 0, 0.2, 1)",
  bounce: "500ms cubic-bezier(0.68, -0.55, 0.265, 1.55)",
} as const;

export const breakpoints = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
} as const;

/**
 * Utility to get consistent card classes
 */
export const cardClasses = {
  base: "glass-panel border border-[var(--b1)] rounded-[var(--r3)]",
  padding: "p-4 md:p-6",
  hover: "hover:border-[var(--b2)] transition-colors",
  interactive: "cursor-pointer hover:shadow-md transition-all",
} as const;

/**
 * Utility to get consistent button classes
 */
export const buttonClasses = {
  base: "inline-flex items-center justify-center gap-2 font-bold rounded-[var(--r3)] transition-all",
  size: {
    sm: "px-4 py-2 text-xs min-h-[44px]",
    md: "px-6 py-3 text-sm min-h-[44px]",
    lg: "px-8 py-4 text-base min-h-[48px]",
  },
  variant: {
    primary: "bg-[var(--amber)] text-white hover:scale-[1.02] active:scale-95",
    secondary: "bg-[var(--s2)] text-[var(--t1)] hover:bg-[var(--s3)]",
    outline:
      "border-2 border-[var(--b1)] text-[var(--t1)] hover:border-[var(--b2)]",
    ghost: "text-[var(--t2)] hover:bg-[var(--s2)]",
  },
} as const;

/**
 * Utility to get consistent spacing classes
 */
export const spacingClasses = {
  section: "space-y-4 md:space-y-6",
  grid: "gap-4 md:gap-6",
  stack: "space-y-3",
  inline: "gap-2 md:gap-3",
} as const;
