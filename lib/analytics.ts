/**
 * Analytics tracking system
 * Supports multiple providers: Vercel Analytics, Google Analytics, PostHog, etc.
 */

type EventProperties = Record<string, any>;

interface AnalyticsEvent {
  name: string;
  properties?: EventProperties;
  timestamp?: number;
}

class Analytics {
  private enabled: boolean;
  private queue: AnalyticsEvent[] = [];

  constructor() {
    this.enabled =
      typeof window !== "undefined" && process.env.NODE_ENV === "production";
  }

  /**
   * Track a custom event
   */
  track(name: string, properties?: EventProperties) {
    if (!this.enabled) {
      console.log("[Analytics]", name, properties);
      return;
    }

    const event: AnalyticsEvent = {
      name,
      properties,
      timestamp: Date.now(),
    };

    // Send to Vercel Analytics
    if (typeof window !== "undefined" && (window as any).va) {
      (window as any).va("event", name, properties);
    }

    // Send to Google Analytics
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", name, properties);
    }

    // Send to PostHog
    if (typeof window !== "undefined" && (window as any).posthog) {
      (window as any).posthog.capture(name, properties);
    }

    // Queue for batch sending
    this.queue.push(event);
  }

  /**
   * Track page view
   */
  page(path: string, properties?: EventProperties) {
    this.track("page_view", { path, ...properties });
  }

  /**
   * Identify user
   */
  identify(userId: string, traits?: EventProperties) {
    if (!this.enabled) return;

    if (typeof window !== "undefined" && (window as any).posthog) {
      (window as any).posthog.identify(userId, traits);
    }
  }

  /**
   * Track deal events
   */
  dealViewed(dealId: string, properties?: EventProperties) {
    this.track("deal_viewed", { deal_id: dealId, ...properties });
  }

  dealSaved(dealId: string, properties?: EventProperties) {
    this.track("deal_saved", { deal_id: dealId, ...properties });
  }

  dealCalculated(dealId: string, profit: number, properties?: EventProperties) {
    this.track("deal_calculated", { deal_id: dealId, profit, ...properties });
  }

  /**
   * Track search events
   */
  searchPerformed(
    query: string,
    results: number,
    properties?: EventProperties,
  ) {
    this.track("search_performed", {
      query,
      results_count: results,
      ...properties,
    });
  }

  filterApplied(filterName: string, properties?: EventProperties) {
    this.track("filter_applied", { filter_name: filterName, ...properties });
  }

  /**
   * Track user actions
   */
  buttonClicked(buttonName: string, properties?: EventProperties) {
    this.track("button_clicked", { button_name: buttonName, ...properties });
  }

  featureUsed(featureName: string, properties?: EventProperties) {
    this.track("feature_used", { feature_name: featureName, ...properties });
  }

  /**
   * Track errors
   */
  error(errorName: string, errorMessage: string, properties?: EventProperties) {
    this.track("error_occurred", {
      error_name: errorName,
      error_message: errorMessage,
      ...properties,
    });
  }

  /**
   * Track conversions
   */
  conversion(
    conversionName: string,
    value?: number,
    properties?: EventProperties,
  ) {
    this.track("conversion", {
      conversion_name: conversionName,
      value,
      ...properties,
    });
  }

  /**
   * Flush queued events
   */
  flush() {
    if (this.queue.length === 0) return;

    // Send batch to your analytics endpoint
    if (this.enabled) {
      fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: this.queue }),
      }).catch(console.error);
    }

    this.queue = [];
  }
}

// Singleton instance
export const analytics = new Analytics();

// Auto-flush every 30 seconds
if (typeof window !== "undefined") {
  setInterval(() => analytics.flush(), 30000);

  // Flush on page unload
  window.addEventListener("beforeunload", () => analytics.flush());
}

/**
 * React hook for analytics
 */
export function useAnalytics() {
  return analytics;
}
