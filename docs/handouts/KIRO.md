# KIRO QA/Data Lane Tasks

**Date:** June 27, 2026  
**Focus:** Unit tests, data quality audits, empty-state copy

---

## Task 1: Unit Tests for Valuation Primitives

### Test File: `lib/scoring/__tests__/valuation-primitives.test.ts`

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import {
  extractPrice,
  extractYear,
  extractMileage,
  normalizeVin,
  isValidVin,
} from "../valuation-primitives";

describe("extractPrice", () => {
  it("should extract price from various formats", () => {
    expect(extractPrice("$15,000")).toBe(15000);
    expect(extractPrice("15000")).toBe(15000);
    expect(extractPrice("$15k")).toBe(15000);
    expect(extractPrice("15K")).toBe(15000);
    expect(extractPrice("Price: $15,000")).toBe(15000);
  });

  it("should handle edge cases", () => {
    expect(extractPrice("Call for price")).toBe(null);
    expect(extractPrice("")).toBe(null);
    expect(extractPrice("Contact dealer")).toBe(null);
    expect(extractPrice("$0")).toBe(null); // Invalid price
  });

  it("should handle decimal prices", () => {
    expect(extractPrice("$15,999.99")).toBe(15999);
    expect(extractPrice("$15.5k")).toBe(15500);
  });

  it("should reject unrealistic prices", () => {
    expect(extractPrice("$1")).toBe(null); // Too low
    expect(extractPrice("$10000000")).toBe(null); // Too high
  });
});

describe("extractYear", () => {
  it("should extract year from various formats", () => {
    expect(extractYear("2020 Honda Accord")).toBe(2020);
    expect(extractYear("Accord 2020")).toBe(2020);
    expect(extractYear("Honda Accord (2020)")).toBe(2020);
    expect(extractYear("20 Accord")).toBe(2020);
  });

  it("should handle current and recent years", () => {
    const currentYear = new Date().getFullYear();
    expect(extractYear(`${currentYear} Model`)).toBe(currentYear);
    expect(extractYear(`${currentYear + 1} Model`)).toBe(currentYear + 1);
  });

  it("should reject invalid years", () => {
    expect(extractYear("1899 Car")).toBe(null); // Too old
    expect(extractYear("2030 Car")).toBe(null); // Too far future
    expect(extractYear("No year here")).toBe(null);
  });

  it("should handle partial year formats", () => {
    expect(extractYear("'20 Honda")).toBe(2020);
    expect(extractYear("'05 Toyota")).toBe(2005);
  });
});

describe("extractMileage", () => {
  it("should extract mileage from various formats", () => {
    expect(extractMileage("90,000 miles")).toBe(90000);
    expect(extractMileage("90k miles")).toBe(90000);
    expect(extractMileage("90k mi")).toBe(90000);
    expect(extractMileage("143,250 miles")).toBe(143250);
    expect(extractMileage("Odometer: 75000")).toBe(75000);
  });

  it("should handle k/K notation", () => {
    expect(extractMileage("50k")).toBe(50000);
    expect(extractMileage("120K")).toBe(120000);
    expect(extractMileage("90.5k")).toBe(90500);
  });

  it("should reject invalid mileage", () => {
    expect(extractMileage("500 miles")).toBe(null); // Too low
    expect(extractMileage("500000 miles")).toBe(null); // Too high
    expect(extractMileage("No mileage")).toBe(null);
  });

  it("should ignore prices in text", () => {
    // Should not confuse "$15k" with "15k miles"
    expect(extractMileage("Price: $15k, 90k miles")).toBe(90000);
  });
});

describe("normalizeVin", () => {
  it("should normalize valid VINs", () => {
    expect(normalizeVin("1HGCV1F30LA000000")).toBe("1HGCV1F30LA000000");
    expect(normalizeVin("1hgcv1f30la000000")).toBe("1HGCV1F30LA000000");
    expect(normalizeVin(" 1HGCV1F30LA000000 ")).toBe("1HGCV1F30LA000000");
  });

  it("should remove invalid characters", () => {
    expect(normalizeVin("VIN: 1HGCV1F30LA000000")).toBe("1HGCV1F30LA000000");
    expect(normalizeVin("1HGCV1F30LA000000.")).toBe("1HGCV1F30LA000000");
  });

  it("should return null for invalid VINs", () => {
    expect(normalizeVin("")).toBe(null);
    expect(normalizeVin("12345")).toBe(null); // Too short
    expect(normalizeVin("1HGCV1F30LA00000O")).toBe(null); // Contains O
    expect(normalizeVin("1HGCV1F30LA00000I")).toBe(null); // Contains I
    expect(normalizeVin("1HGCV1F30LA00000Q")).toBe(null); // Contains Q
  });
});

describe("isValidVin", () => {
  it("should validate correct VINs", () => {
    expect(isValidVin("1HGCV1F30LA000000")).toBe(true);
    expect(isValidVin("5YJSA1E14HF000000")).toBe(true);
  });

  it("should reject invalid VINs", () => {
    expect(isValidVin("")).toBe(false);
    expect(isValidVin("12345")).toBe(false);
    expect(isValidVin("1HGCV1F30LA00000O")).toBe(false); // O not allowed
    expect(isValidVin("1HGCV1F30LA00000I")).toBe(false); // I not allowed
    expect(isValidVin("1HGCV1F30LA00000Q")).toBe(false); // Q not allowed
  });

  it("should validate check digit", () => {
    // Valid VIN with correct check digit
    expect(isValidVin("1HGCM82633A004352")).toBe(true);

    // Invalid check digit
    expect(isValidVin("1HGCM82633A004353")).toBe(false);
  });
});
```

---

## Task 2: Data Quality Audit Script

### Script: `scripts/audit-data-quality.ts`

```typescript
#!/usr/bin/env tsx
/**
 * Data Quality Audit Script (Read-Only)
 *
 * Checks data quality across the deals table and reports issues.
 * Does NOT modify any data - pure audit/reporting.
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface AuditReport {
  timestamp: Date;
  totalDeals: number;
  activeDeals: number;
  issues: {
    category: string;
    severity: "critical" | "warning" | "info";
    count: number;
    percentage: number;
    examples: any[];
  }[];
  summary: {
    critical: number;
    warnings: number;
    info: number;
  };
}

async function auditDataQuality(): Promise<AuditReport> {
  console.log("🔍 Starting data quality audit...\n");

  const report: AuditReport = {
    timestamp: new Date(),
    totalDeals: 0,
    activeDeals: 0,
    issues: [],
    summary: { critical: 0, warnings: 0, info: 0 },
  };

  // Get total counts
  const { count: totalCount } = await supabase
    .from("deals")
    .select("*", { count: "exact", head: true });

  const { count: activeCount } = await supabase
    .from("deals")
    .select("*", { count: "exact", head: true })
    .eq("active", true);

  report.totalDeals = totalCount || 0;
  report.activeDeals = activeCount || 0;

  console.log(`📊 Total deals: ${report.totalDeals}`);
  console.log(`✅ Active deals: ${report.activeDeals}\n`);

  // Check 1: Missing required fields
  await checkMissingFields(report);

  // Check 2: Invalid years
  await checkInvalidYears(report);

  // Check 3: Invalid prices
  await checkInvalidPrices(report);

  // Check 4: Invalid mileage
  await checkInvalidMileage(report);

  // Check 5: Missing VINs
  await checkMissingVins(report);

  // Check 6: Duplicate VINs
  await checkDuplicateVins(report);

  // Check 7: Missing images
  await checkMissingImages(report);

  // Check 8: Missing location data
  await checkMissingLocation(report);

  // Check 9: Stale deals (not updated)
  await checkStaleDeals(report);

  // Check 10: Scoring issues
  await checkScoringIssues(report);

  // Calculate summary
  report.issues.forEach((issue) => {
    report.summary[
      issue.severity === "critical"
        ? "critical"
        : issue.severity === "warning"
          ? "warnings"
          : "info"
    ]++;
  });

  return report;
}

async function checkMissingFields(report: AuditReport) {
  const { data: missing } = await supabase
    .from("deals")
    .select("id, source, title, year, make, model")
    .eq("active", true)
    .or("year.is.null,make.is.null,model.is.null")
    .limit(5);

  if (missing && missing.length > 0) {
    report.issues.push({
      category: "Missing Required Fields",
      severity: "critical",
      count: missing.length,
      percentage: (missing.length / report.activeDeals) * 100,
      examples: missing,
    });
  }
}

async function checkInvalidYears(report: AuditReport) {
  const currentYear = new Date().getFullYear();
  const { data: invalid } = await supabase
    .from("deals")
    .select("id, source, title, year")
    .eq("active", true)
    .or(`year.lt.1990,year.gt.${currentYear + 2}`)
    .limit(5);

  if (invalid && invalid.length > 0) {
    report.issues.push({
      category: "Invalid Years",
      severity: "critical",
      count: invalid.length,
      percentage: (invalid.length / report.activeDeals) * 100,
      examples: invalid,
    });
  }
}

async function checkInvalidPrices(report: AuditReport) {
  const { data: invalid } = await supabase
    .from("deals")
    .select("id, source, title, ask_price")
    .eq("active", true)
    .or("ask_price.lt.100,ask_price.gt.500000")
    .limit(5);

  if (invalid && invalid.length > 0) {
    report.issues.push({
      category: "Invalid Prices",
      severity: "warning",
      count: invalid.length,
      percentage: (invalid.length / report.activeDeals) * 100,
      examples: invalid,
    });
  }
}

async function checkInvalidMileage(report: AuditReport) {
  const { data: invalid } = await supabase
    .from("deals")
    .select("id, source, title, mileage")
    .eq("active", true)
    .not("mileage", "is", null)
    .or("mileage.lt.100,mileage.gt.500000")
    .limit(5);

  if (invalid && invalid.length > 0) {
    report.issues.push({
      category: "Invalid Mileage",
      severity: "warning",
      count: invalid.length,
      percentage: (invalid.length / report.activeDeals) * 100,
      examples: invalid,
    });
  }
}

async function checkMissingVins(report: AuditReport) {
  const { count } = await supabase
    .from("deals")
    .select("*", { count: "exact", head: true })
    .eq("active", true)
    .is("vin", null);

  const percentage = ((count || 0) / report.activeDeals) * 100;

  if (percentage > 50) {
    report.issues.push({
      category: "Missing VINs",
      severity: "info",
      count: count || 0,
      percentage,
      examples: [],
    });
  }
}

async function checkDuplicateVins(report: AuditReport) {
  const { data: duplicates } = await supabase.rpc("find_duplicate_vins", {
    limit_count: 5,
  });

  if (duplicates && duplicates.length > 0) {
    report.issues.push({
      category: "Duplicate VINs",
      severity: "warning",
      count: duplicates.length,
      percentage: (duplicates.length / report.activeDeals) * 100,
      examples: duplicates,
    });
  }
}

async function checkMissingImages(report: AuditReport) {
  const { count } = await supabase
    .from("deals")
    .select("*", { count: "exact", head: true })
    .eq("active", true)
    .or("images.is.null,images.eq.{}");

  const percentage = ((count || 0) / report.activeDeals) * 100;

  if (percentage > 30) {
    report.issues.push({
      category: "Missing Images",
      severity: "info",
      count: count || 0,
      percentage,
      examples: [],
    });
  }
}

async function checkMissingLocation(report: AuditReport) {
  const { count } = await supabase
    .from("deals")
    .select("*", { count: "exact", head: true })
    .eq("active", true)
    .is("location_state", null);

  if (count && count > 0) {
    report.issues.push({
      category: "Missing Location State",
      severity: "warning",
      count,
      percentage: (count / report.activeDeals) * 100,
      examples: [],
    });
  }
}

async function checkStaleDeals(report: AuditReport) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { count } = await supabase
    .from("deals")
    .select("*", { count: "exact", head: true })
    .eq("active", true)
    .lt("last_seen_at", thirtyDaysAgo.toISOString());

  if (count && count > 0) {
    report.issues.push({
      category: "Stale Deals (30+ days)",
      severity: "info",
      count,
      percentage: (count / report.activeDeals) * 100,
      examples: [],
    });
  }
}

async function checkScoringIssues(report: AuditReport) {
  const { count } = await supabase
    .from("deals")
    .select("*", { count: "exact", head: true })
    .eq("active", true)
    .is("profit_score", null);

  if (count && count > 0) {
    report.issues.push({
      category: "Missing Profit Score",
      severity: "warning",
      count,
      percentage: (count / report.activeDeals) * 100,
      examples: [],
    });
  }
}

function printReport(report: AuditReport) {
  console.log("\n📋 AUDIT REPORT");
  console.log("═".repeat(60));
  console.log(`Timestamp: ${report.timestamp.toISOString()}`);
  console.log(`Total Deals: ${report.totalDeals}`);
  console.log(`Active Deals: ${report.activeDeals}\n`);

  if (report.issues.length === 0) {
    console.log("✅ No data quality issues found!\n");
    return;
  }

  // Critical issues
  const critical = report.issues.filter((i) => i.severity === "critical");
  if (critical.length > 0) {
    console.log("🔴 CRITICAL ISSUES:");
    critical.forEach((issue) => {
      console.log(
        `  • ${issue.category}: ${issue.count} (${issue.percentage.toFixed(1)}%)`,
      );
      if (issue.examples.length > 0) {
        console.log(
          `    Examples: ${issue.examples.map((e) => e.id).join(", ")}`,
        );
      }
    });
    console.log("");
  }

  // Warnings
  const warnings = report.issues.filter((i) => i.severity === "warning");
  if (warnings.length > 0) {
    console.log("⚠️  WARNINGS:");
    warnings.forEach((issue) => {
      console.log(
        `  • ${issue.category}: ${issue.count} (${issue.percentage.toFixed(1)}%)`,
      );
    });
    console.log("");
  }

  // Info
  const info = report.issues.filter((i) => i.severity === "info");
  if (info.length > 0) {
    console.log("ℹ️  INFO:");
    info.forEach((issue) => {
      console.log(
        `  • ${issue.category}: ${issue.count} (${issue.percentage.toFixed(1)}%)`,
      );
    });
    console.log("");
  }

  // Summary
  console.log("📊 SUMMARY:");
  console.log(`  Critical: ${report.summary.critical}`);
  console.log(`  Warnings: ${report.summary.warnings}`);
  console.log(`  Info: ${report.summary.info}`);
  console.log("");
}

// Run audit
auditDataQuality()
  .then((report) => {
    printReport(report);
    process.exit(report.summary.critical > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error("❌ Audit failed:", error);
    process.exit(1);
  });
```

---

## Task 3: Bounded Empty-State Copy for 3 Named Pages

### Page 1: `/scan` (Deal Discovery)

**File:** `app/(dashboard)/scan/page.tsx`

```typescript
// Empty state when no deals found
const EmptyState = () => (
  <div className="flex flex-col items-center justify-center py-16 px-4">
    <div className="text-center max-w-md">
      <svg
        className="mx-auto h-12 w-12 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      <h3 className="mt-2 text-sm font-medium text-gray-900">No deals found</h3>
      <p className="mt-1 text-sm text-gray-500">
        Try adjusting your filters or run a scraper to populate the database.
      </p>
      <div className="mt-6 flex gap-3 justify-center">
        <button
          onClick={() => window.location.href = '/scan'}
          className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
        >
          Clear Filters
        </button>
        <a
          href="/developer"
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          Run Scraper
        </a>
      </div>
    </div>
  </div>
);
```

### Page 2: `/saved` (Watchlist)

**File:** `app/(dashboard)/saved/page.tsx`

```typescript
// Empty state when no saved cars
const EmptyState = () => (
  <div className="flex flex-col items-center justify-center py-16 px-4">
    <div className="text-center max-w-md">
      <svg
        className="mx-auto h-12 w-12 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
        />
      </svg>
      <h3 className="mt-2 text-sm font-medium text-gray-900">No saved deals</h3>
      <p className="mt-1 text-sm text-gray-500">
        Browse deals and save the ones you're interested in to track them here.
      </p>
      <div className="mt-6">
        <a
          href="/scan"
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          Browse Deals
        </a>
      </div>
    </div>
  </div>
);
```

### Page 3: `/alerts` (Saved Searches)

**File:** `app/(dashboard)/alerts/page.tsx`

```typescript
// Empty state when no saved searches
const EmptyState = () => (
  <div className="flex flex-col items-center justify-center py-16 px-4">
    <div className="text-center max-w-md">
      <svg
        className="mx-auto h-12 w-12 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>
      <h3 className="mt-2 text-sm font-medium text-gray-900">No saved searches</h3>
      <p className="mt-1 text-sm text-gray-500">
        Create a saved search to get notified when deals matching your criteria appear.
      </p>
      <div className="mt-6">
        <button
          onClick={() => {/* Open create search modal */}}
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          Create Search
        </button>
      </div>
    </div>
  </div>
);
```

---

## Running the Tasks

### Run Unit Tests

```bash
# Run all tests
npm run test

# Run valuation primitive tests only
npm run test valuation-primitives

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Run Data Quality Audit

```bash
# Run audit script
npm run audit:data

# Or directly with tsx
tsx scripts/audit-data-quality.ts

# Save report to file
npm run audit:data > audit-report.txt
```

### Verify Empty States

```bash
# Start dev server
npm run dev

# Visit pages:
# http://localhost:3000/scan (with no deals)
# http://localhost:3000/saved (with no saved cars)
# http://localhost:3000/alerts (with no saved searches)
```

---

## Expected Outcomes

### Unit Tests

- ✅ All valuation primitive functions tested
- ✅ Edge cases covered
- ✅ 90%+ code coverage
- ✅ Fast execution (< 100ms)

### Data Quality Audit

- ✅ Read-only (no modifications)
- ✅ Comprehensive checks (10 categories)
- ✅ Clear severity levels
- ✅ Actionable examples

### Empty States

- ✅ Bounded copy (2-3 lines max)
- ✅ Clear CTAs
- ✅ Helpful guidance
- ✅ Consistent design

---

**Tasks complete and ready for QA review!**
