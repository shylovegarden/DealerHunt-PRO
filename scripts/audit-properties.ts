#!/usr/bin/env tsx
/**
 * Properties Data Quality Audit Script (Read-Only)
 *
 * Audits the `properties` table (HomeIQ housing vertical) for data quality issues.
 * Mirrors the spirit of audit-data-quality.ts but focused on housing-specific checks.
 * Does NOT modify any data - pure audit/reporting.
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

interface AuditReport {
  timestamp: Date;
  totalProperties: number;
  activeProperties: number;
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

async function auditProperties(): Promise<AuditReport> {
  console.log("🏠 Starting properties data quality audit...\n");

  const report: AuditReport = {
    timestamp: new Date(),
    totalProperties: 0,
    activeProperties: 0,
    issues: [],
    summary: { critical: 0, warnings: 0, info: 0 },
  };

  // Check if table exists
  const { count: totalCount, error: tableError } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true });

  if (tableError) {
    console.error("❌ Properties table not accessible:", tableError.message);
    console.log("\nℹ️  This is expected if HomeIQ hasn't been deployed yet.");
    process.exit(1);
  }

  const { count: activeCount } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .eq("active", true);

  report.totalProperties = totalCount || 0;
  report.activeProperties = activeCount || 0;

  console.log(`📊 Total properties: ${report.totalProperties}`);
  console.log(`✅ Active properties: ${report.activeProperties}\n`);

  if (report.activeProperties === 0) {
    console.log("ℹ️  No active properties found - skipping detailed checks.\n");
    printReport(report);
    process.exit(0);
  }

  // Check 1: Missing location data (city/state)
  await checkMissingLocation(report);

  // Check 2: Missing price
  await checkMissingPrice(report);

  // Check 3: Invalid prices
  await checkInvalidPrices(report);

  // Check 4: Junk titles
  await checkJunkTitles(report);

  // Check 5: Duplicate addresses
  await checkDuplicateAddresses(report);

  // Check 6: Missing property type
  await checkMissingPropertyType(report);

  // Check 7: Missing images
  await checkMissingImages(report);

  // Check 8: Invalid square footage
  await checkInvalidSqft(report);

  // Check 9: Missing lead scores
  await checkMissingLeadScores(report);

  // Check 10: Stale properties (30+ days)
  await checkStaleProperties(report);

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

async function checkMissingLocation(report: AuditReport) {
  const { data: noCity } = await supabase
    .from("properties")
    .select("id, source, title, address, city, state")
    .eq("active", true)
    .is("city", null)
    .limit(5);

  const { data: noState } = await supabase
    .from("properties")
    .select("id, source, title, address, city, state")
    .eq("active", true)
    .is("state", null)
    .limit(5);

  const cityCount = noCity?.length || 0;
  const stateCount = noState?.length || 0;

  if (stateCount > 0) {
    report.issues.push({
      category: "Missing State",
      severity: "critical",
      count: stateCount,
      percentage: (stateCount / report.activeProperties) * 100,
      examples: noState || [],
    });
  }

  if (cityCount > 0) {
    report.issues.push({
      category: "Missing City",
      severity: "warning",
      count: cityCount,
      percentage: (cityCount / report.activeProperties) * 100,
      examples: noCity || [],
    });
  }
}

async function checkMissingPrice(report: AuditReport) {
  const { count } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .eq("active", true)
    .is("price", null);

  if (count && count > 0) {
    const { data: examples } = await supabase
      .from("properties")
      .select("id, source, title, price")
      .eq("active", true)
      .is("price", null)
      .limit(5);

    report.issues.push({
      category: "Missing Price",
      severity: "critical",
      count,
      percentage: (count / report.activeProperties) * 100,
      examples: examples || [],
    });
  }
}

async function checkInvalidPrices(report: AuditReport) {
  const { data: invalid } = await supabase
    .from("properties")
    .select("id, source, title, price")
    .eq("active", true)
    .not("price", "is", null)
    .or("price.lt.100,price.gt.50000000")
    .limit(5);

  if (invalid && invalid.length > 0) {
    report.issues.push({
      category: "Invalid Prices (<$100 or >$50M)",
      severity: "warning",
      count: invalid.length,
      percentage: (invalid.length / report.activeProperties) * 100,
      examples: invalid,
    });
  }
}

async function checkJunkTitles(report: AuditReport) {
  // Check for very short titles, all-caps spam, or missing titles
  const { data: junk } = await supabase
    .from("properties")
    .select("id, source, title")
    .eq("active", true)
    .or("title.is.null,title.eq.")
    .limit(5);

  if (junk && junk.length > 0) {
    report.issues.push({
      category: "Missing/Empty Titles",
      severity: "warning",
      count: junk.length,
      percentage: (junk.length / report.activeProperties) * 100,
      examples: junk,
    });
  }
}

async function checkDuplicateAddresses(report: AuditReport) {
  // Find properties with same address+city+state across different sources
  const { data: allProps } = await supabase
    .from("properties")
    .select("id, source, address, city, state")
    .eq("active", true)
    .not("address", "is", null);

  if (!allProps) return;

  const addressMap = new Map<string, any[]>();
  for (const prop of allProps) {
    const key = `${prop.address}|${prop.city}|${prop.state}`.toLowerCase();
    if (!addressMap.has(key)) {
      addressMap.set(key, []);
    }
    addressMap.get(key)!.push(prop);
  }

  const duplicates = Array.from(addressMap.values())
    .filter((props) => props.length > 1)
    .slice(0, 5);

  if (duplicates.length > 0) {
    const totalDupes = Array.from(addressMap.values()).filter(
      (props) => props.length > 1,
    ).length;
    report.issues.push({
      category: "Duplicate Addresses",
      severity: "info",
      count: totalDupes,
      percentage: (totalDupes / report.activeProperties) * 100,
      examples: duplicates.map((group) => ({
        address: group[0].address,
        city: group[0].city,
        state: group[0].state,
        count: group.length,
        sources: group.map((p) => p.source),
      })),
    });
  }
}

async function checkMissingPropertyType(report: AuditReport) {
  const { count } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .eq("active", true)
    .is("property_type", null);

  if (count && count > 0) {
    const { data: examples } = await supabase
      .from("properties")
      .select("id, source, title, property_type")
      .eq("active", true)
      .is("property_type", null)
      .limit(5);

    report.issues.push({
      category: "Missing Property Type",
      severity: "warning",
      count,
      percentage: (count / report.activeProperties) * 100,
      examples: examples || [],
    });
  }
}

async function checkMissingImages(report: AuditReport) {
  const { count } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .eq("active", true)
    .or("images.is.null,images.eq.{}");

  const percentage = ((count || 0) / report.activeProperties) * 100;

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

async function checkInvalidSqft(report: AuditReport) {
  const { data: invalid } = await supabase
    .from("properties")
    .select("id, source, title, sqft, property_type")
    .eq("active", true)
    .not("sqft", "is", null)
    .or("sqft.lt.50,sqft.gt.50000")
    .limit(5);

  if (invalid && invalid.length > 0) {
    report.issues.push({
      category: "Invalid Square Footage (<50 or >50k)",
      severity: "warning",
      count: invalid.length,
      percentage: (invalid.length / report.activeProperties) * 100,
      examples: invalid,
    });
  }
}

async function checkMissingLeadScores(report: AuditReport) {
  const { count } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .eq("active", true)
    .is("lead_score", null);

  if (count && count > 0) {
    const { data: examples } = await supabase
      .from("properties")
      .select("id, source, title, lead_score, lead_tier")
      .eq("active", true)
      .is("lead_score", null)
      .limit(5);

    report.issues.push({
      category: "Missing Lead Score",
      severity: "warning",
      count,
      percentage: (count / report.activeProperties) * 100,
      examples: examples || [],
    });
  }
}

async function checkStaleProperties(report: AuditReport) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { count } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .eq("active", true)
    .lt("scraped_at", thirtyDaysAgo.toISOString());

  if (count && count > 0) {
    report.issues.push({
      category: "Stale Properties (30+ days)",
      severity: "info",
      count,
      percentage: (count / report.activeProperties) * 100,
      examples: [],
    });
  }
}

function printReport(report: AuditReport) {
  console.log("\n📋 PROPERTIES AUDIT REPORT");
  console.log("═".repeat(60));
  console.log(`Timestamp: ${report.timestamp.toISOString()}`);
  console.log(`Total Properties: ${report.totalProperties}`);
  console.log(`Active Properties: ${report.activeProperties}\n`);

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
          `    Examples: ${issue.examples.map((e) => e.id || JSON.stringify(e)).join(", ")}`,
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
      if (issue.examples.length > 0 && issue.examples[0].id) {
        console.log(
          `    Examples: ${issue.examples.map((e) => e.id).join(", ")}`,
        );
      }
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
auditProperties()
  .then((report) => {
    printReport(report);
    process.exit(report.summary.critical > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error("❌ Audit failed:", error);
    process.exit(1);
  });
