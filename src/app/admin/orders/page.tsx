import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { updateOrderStatusAction } from "@/lib/admin-actions";
import { StatusPill } from "@/components/ui";
import { DELIVERY_LABELS, ORDER_STATUSES, PAYMENT_LABELS, STATUS_LABELS, formatDate, formatXAF } from "@/lib/utils";

import { guardPage } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function OrdersQueue({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await guardPage("orders");
  const params = await searchParams;
  const filter = typeof params.status === "string" ? params.status : "";
  const rows = await db
    .select()
    .from(orders)
    .where(filter ? sql`${orders.status} = ${filter}` : sql`true`)
    .orderBy(desc(orders.createdAt))
    .limit(100);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="display text-3xl">Orders queue</h1>
        <a className="btn btn-secondary btn-sm" href="/api/admin/export?type=orders">Export CSV</a>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/admin/orders" className={`chip ${!filter ? "chip-active" : ""}`}>All</Link>
        {ORDER_STATUSES.map((status) => (
          <Link key={status} href={`/admin/orders?status=${status}`} className={`chip ${filter === status ? "chip-active" : ""}`}>
            {STATUS_LABELS[status]}
          </Link>
        ))}
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs tracking-[0.12em] uppercase text-muted">
              <th className="py-3">Order</th><th>Customer</th><th>Delivery</th><th>Payment</th><th>Total</th><th>Status</th><th>Move to</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((order) => (
              <tr key={order.id} className="border-b border-line/70">
                <td className="py-3">
                  <Link href={`/admin/orders/${order.id}`} className="link-underline">{order.orderNumber}</Link>
                  <span className="block text-xs text-muted">{formatDate(order.createdAt)}</span>
                </td>
                <td>{order.customerName}<span className="block text-xs text-muted">{order.guestPhone}</span></td>
                <td className="text-xs">{DELIVERY_LABELS[order.deliveryMethod]}<span className="block text-muted">{order.deliveryZone}</span></td>
                <td className="text-xs">{PAYMENT_LABELS[order.paymentMethod]}<span className="block text-muted">{order.paymentStatus}</span></td>
                <td>{formatXAF(order.total)}</td>
                <td><StatusPill status={order.status} /></td>
                <td>
                  <form action={updateOrderStatusAction} className="flex items-center gap-1">
                    <input type="hidden" name="id" value={order.id} />
                    <select name="status" defaultValue={order.status} className="field px-2 py-1 text-xs">
                      {ORDER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                    <button className="btn btn-ghost btn-sm">Update</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="mt-6 text-sm text-muted">No orders with that status.</p> : null}
      </div>
    </div>
  );
}
