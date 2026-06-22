/**
 * Performance monitoring and optimization utilities
 */

export class PerformanceMonitor {
  private marks: Map<string, number> = new Map();
  private measures: Map<string, number> = new Map();

  /**
   * Mark the start of a performance measurement
   */
  mark(name: string) {
    if (typeof window === "undefined") return;
    this.marks.set(name, performance.now());
  }

  /**
   * Measure time since mark
   */
  measure(name: string, markName: string): number {
    if (typeof window === "undefined") return 0;

    const startTime = this.marks.get(markName);
    if (!startTime) return 0;

    const duration = performance.now() - startTime;
    this.measures.set(name, duration);

    if (process.env.NODE_ENV === "development") {
      console.log(`⚡ ${name}: ${duration.toFixed(2)}ms`);
    }

    return duration;
  }

  /**
   * Get all measurements
   */
  getMeasures(): Record<string, number> {
    return Object.fromEntries(this.measures);
  }

  /**
   * Clear all marks and measures
   */
  clear() {
    this.marks.clear();
    this.measures.clear();
  }
}

export const perfMonitor = new PerformanceMonitor();

/**
 * FPS Counter for development
 */
export class FPSCounter {
  private frames: number[] = [];
  private lastTime = performance.now();
  private rafId: number | null = null;

  start(callback: (fps: number) => void) {
    if (typeof window === "undefined") return;

    const measure = () => {
      const now = performance.now();
      const delta = now - this.lastTime;
      this.lastTime = now;

      this.frames.push(1000 / delta);
      if (this.frames.length > 60) {
        this.frames.shift();
      }

      const fps = Math.round(
        this.frames.reduce((a, b) => a + b, 0) / this.frames.length,
      );

      callback(fps);
      this.rafId = requestAnimationFrame(measure);
    };

    this.rafId = requestAnimationFrame(measure);
  }

  stop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}

/**
 * Debounce function for performance
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function for performance
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Measure component render time
 */
export function measureRender(componentName: string) {
  if (process.env.NODE_ENV !== "development") return;

  const startMark = `${componentName}-render-start`;
  const endMark = `${componentName}-render-end`;

  performance.mark(startMark);

  return () => {
    performance.mark(endMark);
    performance.measure(componentName, startMark, endMark);

    const measure = performance.getEntriesByName(componentName)[0];
    if (measure) {
      console.log(
        `🎨 ${componentName} rendered in ${measure.duration.toFixed(2)}ms`,
      );
    }
  };
}
