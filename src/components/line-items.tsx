"use client";

import { Trash2 } from "lucide-react";
import { money } from "@/lib/format";
import type { LineItem } from "@/lib/types";
import { useData } from "./data";
import { Card, inputCls } from "./ui";

export const lineTotal = (items: LineItem[] = []) => items.reduce((sum, li) => sum + (Number(li.quantity) || 0) * (Number(li.price) || 0), 0);

/** Product rows on a deal or an order. `onChange` receives the new rows. */
export function LineItems({ items = [], onChange, footer }: { items?: LineItem[]; onChange: (items: LineItem[]) => void; footer?: React.ReactNode }) {
  const { db } = useData();
  const available = db.products.filter((p) => p.active);
  const patch = (i: number, p: Partial<LineItem>) => onChange(items.map((li, k) => (k === i ? { ...li, ...p } : li)));

  return (
    <Card title={`Line items (${items.length})`}>
      {items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-2 font-medium">Product</th>
                <th className="w-24 px-2 py-2 font-medium">Qty</th>
                <th className="w-32 px-2 py-2 font-medium">Unit price</th>
                <th className="w-28 px-4 py-2 text-right font-medium">Total</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {items.map((li, i) => (
                <tr key={i}>
                  <td className="px-4 py-2 font-medium text-stone-900">{li.name}</td>
                  <td className="px-2 py-2">
                    <input type="number" min={1} aria-label={`Quantity of ${li.name}`} className={inputCls} value={li.quantity} onChange={(e) => patch(i, { quantity: Number(e.target.value) })} />
                  </td>
                  <td className="px-2 py-2">
                    <input type="number" min={0} aria-label={`Unit price of ${li.name}`} className={inputCls} value={li.price} onChange={(e) => patch(i, { price: Number(e.target.value) })} />
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(li.quantity * li.price)}</td>
                  <td className="py-2 pr-2">
                    <button type="button" aria-label={`Remove ${li.name}`} onClick={() => onChange(items.filter((_, k) => k !== i))} className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-rose-600">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 border-t border-stone-100 px-4 py-3">
        <select
          aria-label="Add a product"
          className={`${inputCls} !w-auto`}
          value=""
          onChange={(e) => {
            const p = db.products.find((x) => x.id === e.target.value);
            if (p) onChange([...items, { productId: p.id, name: p.name, quantity: 1, price: p.price }]);
          }}
        >
          <option value="">Add a product…</option>
          {available.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {money(p.price)}
            </option>
          ))}
        </select>
        {footer}
        <span className="ml-auto text-sm text-stone-600">
          Total <span className="font-semibold tabular-nums text-stone-900">{money(lineTotal(items))}</span>
        </span>
      </div>
    </Card>
  );
}
