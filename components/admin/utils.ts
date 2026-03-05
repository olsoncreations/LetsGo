// components/admin/utils.ts

export function formatMoney(cents: number): string {
  return "$" + (cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatMoneyDollars(dollars: number): string {
  return "$" + dollars.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function getHoursSince(dateString: string): number {
  const created = new Date(dateString);
  const now = new Date();
  return Math.round((now.getTime() - created.getTime()) / (1000 * 60 * 60));
}

export function getDaysSince(dateString: string): number {
  const created = new Date(dateString);
  const now = new Date();
  return Math.round((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function exportCSV(data: Record<string, unknown>[], filename: string): void {
  if (!data || data.length === 0) return;
  
  const headers = Object.keys(data[0]).join(",");
  const rows = data
    .map((row) =>
      Object.values(row)
        .map((v) =>
          typeof v === "object" ? JSON.stringify(v).replace(/,/g, ";") : v
        )
        .join(",")
    )
    .join("\n");
  
  const csv = headers + "\n" + rows;
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename + ".csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function truncate(str: string, length: number): string {
  if (!str) return "";
  return str.length > length ? str.slice(0, length) + "..." : str;
}






