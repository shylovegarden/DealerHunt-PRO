import { toast } from "sonner";

export interface BulkOperationResult {
  success: number;
  failed: number;
  errors: string[];
}

/**
 * Bulk save vehicles to watchlist
 */
export async function bulkSaveToWatchlist(
  vehicleIds: string[],
  dealerId: string,
): Promise<BulkOperationResult> {
  const result: BulkOperationResult = { success: 0, failed: 0, errors: [] };

  const toastId = toast.loading(`Saving ${vehicleIds.length} vehicles...`);

  try {
    const response = await fetch("/api/saved-cars/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vehicleIds, dealerId }),
    });

    const data = await response.json();

    if (data.success) {
      result.success = data.saved || vehicleIds.length;
      toast.success(`Saved ${result.success} vehicles to watchlist`, {
        id: toastId,
      });
    } else {
      result.failed = vehicleIds.length;
      result.errors.push(data.error || "Unknown error");
      toast.error(`Failed to save vehicles: ${data.error}`, { id: toastId });
    }
  } catch (error: any) {
    result.failed = vehicleIds.length;
    result.errors.push(error.message);
    toast.error(`Error: ${error.message}`, { id: toastId });
  }

  return result;
}

/**
 * Bulk export to CSV
 */
export function exportToCSV(data: any[], filename: string) {
  if (data.length === 0) {
    toast.error("No data to export");
    return;
  }

  const toastId = toast.loading("Generating CSV...");

  try {
    // Get headers from first object
    const headers = Object.keys(data[0]);

    // Create CSV content
    const csvContent = [
      headers.join(","),
      ...data.map((row) =>
        headers
          .map((header) => {
            const value = row[header];
            // Escape commas and quotes
            if (
              typeof value === "string" &&
              (value.includes(",") || value.includes('"'))
            ) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value ?? "";
          })
          .join(","),
      ),
    ].join("\n");

    // Create download link
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `${filename}-${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(`Exported ${data.length} rows to CSV`, { id: toastId });
  } catch (error: any) {
    toast.error(`Export failed: ${error.message}`, { id: toastId });
  }
}

/**
 * Bulk update status
 */
export async function bulkUpdateStatus(
  itemIds: string[],
  newStatus: string,
  endpoint: string,
): Promise<BulkOperationResult> {
  const result: BulkOperationResult = { success: 0, failed: 0, errors: [] };

  const toastId = toast.loading(`Updating ${itemIds.length} items...`);

  for (const id of itemIds) {
    try {
      const response = await fetch(`${endpoint}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        result.success++;
      } else {
        result.failed++;
        result.errors.push(`Failed to update ${id}`);
      }
    } catch (error: any) {
      result.failed++;
      result.errors.push(error.message);
    }
  }

  if (result.success > 0) {
    toast.success(`Updated ${result.success} items`, { id: toastId });
  }
  if (result.failed > 0) {
    toast.error(`Failed to update ${result.failed} items`, { id: toastId });
  }

  return result;
}

/**
 * Bulk delete
 */
export async function bulkDelete(
  itemIds: string[],
  endpoint: string,
  confirmMessage?: string,
): Promise<BulkOperationResult> {
  const result: BulkOperationResult = { success: 0, failed: 0, errors: [] };

  if (confirmMessage && !confirm(confirmMessage)) {
    return result;
  }

  const toastId = toast.loading(`Deleting ${itemIds.length} items...`);

  for (const id of itemIds) {
    try {
      const response = await fetch(`${endpoint}/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        result.success++;
      } else {
        result.failed++;
        result.errors.push(`Failed to delete ${id}`);
      }
    } catch (error: any) {
      result.failed++;
      result.errors.push(error.message);
    }
  }

  if (result.success > 0) {
    toast.success(`Deleted ${result.success} items`, { id: toastId });
  }
  if (result.failed > 0) {
    toast.error(`Failed to delete ${result.failed} items`, { id: toastId });
  }

  return result;
}

/**
 * Batch transport quotes
 */
export async function batchTransportQuotes(
  routes: Array<{ from: string; to: string }>,
  dealerId: string,
): Promise<any[]> {
  const toastId = toast.loading(`Calculating ${routes.length} quotes...`);

  try {
    const promises = routes.map((route) =>
      fetch(
        `/api/transport/quote?from=${route.from}&to=${route.to}&dealerId=${dealerId}`,
      ).then((res) => res.json()),
    );

    const results = await Promise.all(promises);
    toast.success(`Calculated ${results.length} transport quotes`, {
      id: toastId,
    });
    return results;
  } catch (error: any) {
    toast.error(`Failed to calculate quotes: ${error.message}`, {
      id: toastId,
    });
    return [];
  }
}
