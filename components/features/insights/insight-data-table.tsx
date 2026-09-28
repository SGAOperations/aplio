import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export interface InsightDataTableProps {
  headers: string[];
  rows: (string | number)[][];
}

/** The colour-free channel for every chart series — same rows as the chart above it. */
export function InsightDataTable({ headers, rows }: InsightDataTableProps) {
  return (
    <div className="max-h-64 overflow-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((header) => (
              <TableHead key={header}>{header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i}>
              {row.map((cell, j) => (
                <TableCell key={j}>{cell}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
