export function serializeCsv(headers: readonly string[], rows: readonly (readonly unknown[])[]) {
  const escapeCell = (value: unknown) => {
    let cell = value == null ? "" : String(value);
    if (/^[\t\r ]*[=+\-@]/.test(cell)) cell = `'${cell}`;
    return `"${cell.replace(/"/g, '""')}"`;
  };

  return [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\r\n");
}

export function downloadCsv(
  filename: string,
  headers: readonly string[],
  rows: readonly (readonly unknown[])[],
) {
  const blob = new Blob(["\uFEFF", serializeCsv(headers, rows)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
