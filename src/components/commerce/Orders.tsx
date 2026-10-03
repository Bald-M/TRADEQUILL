import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  currencies,
  localDateValue,
  type BusinessSnapshot,
} from "@/lib/business";
import {
  costCategories,
  draftCostFromOffer,
  getOrderHistory,
  orderStatuses,
  saveOrderCosts,
  transitionOrder,
  updateOrder,
  type CommerceRoute,
  type CommerceSnapshot,
  type CostEntry,
  type Order,
  type OrderEvent,
} from "@/lib/commerce";
import {
  ActionButton,
  Empty,
  ErrorMessage,
  Field,
  SaveForm,
  TextField,
  fieldClass,
  messageOf,
} from "./Shared";
import { QuoteView } from "./Quotes";

type Props = {
  snapshot: CommerceSnapshot;
  business: BusinessSnapshot;
  refresh: () => Promise<void>;
  navigate: (route: CommerceRoute) => void;
  route: CommerceRoute;
};
export function ProfitView({ order }: { order: Omit<Order, "id"> }) {
  const profit = order.profit;
  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium">订单经营测算 · {order.quote.currency}</h3>
        <Badge variant="outline">
          {profit.complete
            ? "成本已完整确认"
            : profit.missingRates
              ? "汇率待补全"
              : "成本未完整 / 暂估"}
        </Badge>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm lg:grid-cols-4">
        <dt>销售收入</dt>
        <dd>{order.quote.total}</dd>
        <dt>商品采购</dt>
        <dd>{profit.purchase ?? "待补全"}</dd>
        <dt>支出运费</dt>
        <dd>{profit.freight ?? "待补全"}</dd>
        <dt>支出税费</dt>
        <dd>{profit.tax ?? "待补全"}</dd>
        <dt>其他费用</dt>
        <dd>{profit.other ?? "待补全"}</dd>
        <dt>费用合计</dt>
        <dd>{profit.totalCost ?? "待补全"}</dd>
        <dt>{profit.complete ? "利润" : "暂估利润"}</dt>
        <dd className="font-semibold">{profit.profit ?? "待计算"}</dd>
        <dt>利润率</dt>
        <dd>
          {profit.profit === null
            ? "待计算"
            : profit.margin === null
              ? "不适用（零收入）"
              : `${profit.margin}%`}
        </dd>
      </dl>
      <p className="text-xs leading-5 text-muted-foreground">
        收入 = 商品小计 − 折扣 + 向客户收取的税费和运费。利润 = 收入 − 商品采购
        − 支出运费 − 支出税费 − 其他费用；利润率 = 利润 /
        收入。费用每笔只录入一次；已包含在采购成本中的运费不能再次扣除。这是经营测算，不代表收款、现金流或税务利润。
      </p>
      {!profit.complete && (
        <p className="text-sm">
          {profit.missingRates
            ? `${profit.missingRates} 条费用缺少汇率，利润待计算。`
            : "成本尚未完整确认，未录费用不视为已确认零成本，暂估结果不是最终利润。"}
        </p>
      )}
      {order.costsComplete && (
        <p className="text-sm whitespace-pre-wrap">
          成本确认：{order.completenessNote}
        </p>
      )}
    </div>
  );
}
function CostList({
  entries,
  currency,
}: {
  entries: CostEntry[];
  currency: string;
}) {
  return (
    <div className="space-y-2">
      {entries.length ? (
        entries.map((cost, index) => (
          <div key={index} className="rounded-md border p-3 text-sm leading-6">
            <p className="font-medium">
              {costCategories[cost.category]} · {cost.currency} {cost.amount} ·{" "}
              {cost.confirmed ? "已确认金额" : "参考/暂估金额"}
            </p>
            <p>
              {cost.occurredOn} · {cost.supplierName || "无供应商"}
            </p>
            {cost.currency !== currency && (
              <p>
                汇率：
                {cost.rate === null
                  ? "待补全"
                  : `1 ${cost.currency} = ${cost.rate} ${currency}，日期 ${cost.rateOn}`}
              </p>
            )}
            {cost.notes && <p className="whitespace-pre-wrap">{cost.notes}</p>}
          </div>
        ))
      ) : (
        <Empty>尚未录入费用。只有完整确认后，空费用才代表已确认零成本。</Empty>
      )}
    </div>
  );
}
function OrderEditor({
  order,
  snapshot,
  refresh,
  done,
}: {
  order: Order;
  snapshot: CommerceSnapshot;
  refresh: () => Promise<void>;
  done: () => void;
}) {
  const [form, setForm] = useState({
    id: order.id,
    expectedVersion: order.version,
    orderedOn: order.orderedOn,
    deliveryOn: order.deliveryOn,
    notes: order.notes,
    sourceQuoteId: order.sourceQuoteId,
    reason: "",
  });
  return (
    <SaveForm
      save={() => updateOrder(form)}
      refresh={refresh}
      onDone={done}
      onCancel={done}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <TextField
          label="订单日期 *"
          type="date"
          value={form.orderedOn}
          onChange={(orderedOn) => setForm({ ...form, orderedOn })}
          required
        />
        <TextField
          label="承诺交付日期（可选）"
          type="date"
          value={form.deliveryOn ?? ""}
          onChange={(deliveryOn) =>
            setForm({ ...form, deliveryOn: deliveryOn || null })
          }
        />
        <Field label="承接报价修订">
          {(id) => (
            <select
              id={id}
              className={fieldClass}
              value={form.sourceQuoteId}
              onChange={(e) =>
                setForm({ ...form, sourceQuoteId: Number(e.target.value) })
              }
            >
              {snapshot.quotes
                .filter(
                  (q) =>
                    q.seriesId === order.quote.seriesId &&
                    q.revision >= order.quote.revision,
                )
                .map((q) => (
                  <option key={q.quoteId} value={q.quoteId}>
                    {q.number} · {q.currency} {q.total}
                  </option>
                ))}
            </select>
          )}
        </Field>
      </div>
      <p className="text-sm text-muted-foreground">
        销售金额通过新报价修订更正，保存会留下更正原因和快照。确认后销售数据冻结；取消后可用报价新修订重开。
      </p>
      <TextField
        label="订单备注"
        multiline
        value={form.notes}
        onChange={(notes) => setForm({ ...form, notes })}
      />
      <TextField
        label="更正原因 *"
        value={form.reason}
        onChange={(reason) => setForm({ ...form, reason })}
        required
      />
    </SaveForm>
  );
}
function StatusForm({
  order,
  status,
  refresh,
  done,
}: {
  order: Order;
  status: "confirmed" | "cancelled";
  refresh: () => Promise<void>;
  done: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <SaveForm
      label={status === "confirmed" ? "确认订单并冻结销售数据" : "确认取消订单"}
      save={() =>
        transitionOrder({
          id: order.id,
          expectedVersion: order.version,
          status,
          reason,
        })
      }
      refresh={refresh}
      onDone={done}
      onCancel={done}
    >
      <p className="text-sm leading-6">
        {status === "confirmed"
          ? "确认后，订单日期和销售金额将冻结；该订单开始纳入经营统计，成本仍可继续补充。此操作不代表已收款或已履约。"
          : "取消后保留全部快照和成本历史，退出经营统计且不能继续编辑。不记录退款或现金流；重新交易请修订报价后生成新订单。"}
      </p>
      <TextField
        label="状态变更说明 *"
        value={reason}
        onChange={setReason}
        required
      />
    </SaveForm>
  );
}
function CostsForm({
  order,
  snapshot,
  refresh,
  done,
}: {
  order: Order;
  snapshot: CommerceSnapshot;
  refresh: () => Promise<void>;
  done: () => void;
}) {
  const [entries, setEntries] = useState<CostEntry[]>(() =>
    structuredClone(order.costs),
  );
  const [complete, setComplete] = useState(order.costsComplete);
  const [note, setNote] = useState(order.completenessNote);
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const version = useRef(order.version);
  const change = (index: number, patch: Partial<CostEntry>) => {
    setEntries((current) =>
      current.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
    );
    setComplete(false);
  };
  return (
    <SaveForm
      save={() =>
        saveOrderCosts({
          orderId: order.id,
          expectedVersion: version.current,
          entries,
          complete,
          completenessNote: note,
          reason,
        })
      }
      refresh={refresh}
      onDone={done}
      onCancel={done}
      label="保存成本并重算"
    >
      <p className="text-sm leading-6">
        每笔支出只录入一次；采购价已含的运费/税费请勿重复录入。未知费用先留待补充，明确零成本可录入
        0 并确认。跨币种不自动获取汇率。
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <Field label="调用供货参考价（生成待确认草稿）">
            {(id) => (
              <select
                id={id}
                className={fieldClass}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              >
                <option value="">选择产品和供应商参考价</option>
                {order.quote.lines.flatMap((line, index) =>
                  snapshot.offers
                    .filter(
                      (o) =>
                        o.productId === line.productId &&
                        o.active &&
                        o.price !== null &&
                        !snapshot.suppliers.find((s) => s.id === o.supplierId)
                          ?.archived,
                    )
                    .map((offer) => (
                      <option
                        key={`${index}-${offer.id}`}
                        value={`${index}:${offer.id}`}
                      >
                        {line.product.code} ·{" "}
                        {
                          snapshot.suppliers.find(
                            (s) => s.id === offer.supplierId,
                          )?.name
                        }{" "}
                        · {offer.currency} {offer.price} ({offer.quotedOn})
                      </option>
                    )),
                )}
              </select>
            )}
          </Field>
        </div>
        <ActionButton
          disabled={!reference}
          action={async () => {
            const [lineIndex, offerId] = reference.split(":").map(Number);
            const draft = await draftCostFromOffer(
              order.id,
              lineIndex,
              offerId,
              localDateValue(),
            );
            setEntries((current) => [...current, draft]);
            setComplete(false);
          }}
        >
          添加参考成本
        </ActionButton>
      </div>
      {entries.map((entry, index) => (
        <fieldset key={index} className="space-y-3 rounded-lg border p-4">
          <legend className="px-2 text-sm font-medium">费用 {index + 1}</legend>
          <div className="grid gap-3 lg:grid-cols-2">
            <Field label={`费用 ${index + 1} 分类`}>
              {(id) => (
                <select
                  id={id}
                  className={fieldClass}
                  value={entry.category}
                  onChange={(e) =>
                    change(index, {
                      category: e.target.value as CostEntry["category"],
                    })
                  }
                >
                  {Object.entries(costCategories).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <TextField
              label={`费用 ${index + 1} 金额 *`}
              value={entry.amount}
              onChange={(amount) => change(index, { amount, confirmed: false })}
              hint={
                entry.currency === "JPY"
                  ? "日元整数；0 表示明确零费用"
                  : "最多 2 位小数；0 表示明确零费用"
              }
              required
            />
            <Field label={`费用 ${index + 1} 币种`}>
              {(id) => (
                <select
                  id={id}
                  className={fieldClass}
                  value={entry.currency}
                  onChange={(e) =>
                    change(index, {
                      currency: e.target.value,
                      rate: null,
                      rateOn: null,
                      confirmed: false,
                    })
                  }
                >
                  {currencies.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              )}
            </Field>
            <TextField
              label={`费用 ${index + 1} 日期 *`}
              type="date"
              value={entry.occurredOn}
              onChange={(occurredOn) => change(index, { occurredOn })}
              required
            />
            <Field label={`费用 ${index + 1} 供应商`}>
              {(id) => (
                <select
                  id={id}
                  className={fieldClass}
                  value={entry.supplierId ?? ""}
                  onChange={(e) =>
                    change(index, {
                      supplierId: e.target.value
                        ? Number(e.target.value)
                        : null,
                      offerId: null,
                    })
                  }
                >
                  <option value="">无供应商</option>
                  {snapshot.suppliers
                    .filter((s) => !s.archived || s.id === entry.supplierId)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                        {s.archived ? "（已归档）" : ""}
                      </option>
                    ))}
                </select>
              )}
            </Field>
            <Field label={`费用 ${index + 1} 关联产品`}>
              {(id) => (
                <select
                  id={id}
                  className={fieldClass}
                  value={entry.productId ?? ""}
                  onChange={(e) =>
                    change(index, {
                      productId: e.target.value ? Number(e.target.value) : null,
                      offerId: null,
                    })
                  }
                >
                  <option value="">订单级费用</option>
                  {Array.from(
                    new Map(
                      order.quote.lines.map((l) => [l.productId, l]),
                    ).values(),
                  ).map((line) => (
                    <option key={line.productId} value={line.productId}>
                      {line.product.code} · {line.product.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            {entry.currency !== order.quote.currency && (
              <>
                <TextField
                  label={`费用 ${index + 1} 手动汇率`}
                  hint={`1 ${entry.currency} = X ${order.quote.currency}，最多 6 位小数；与日期都留空则待补全`}
                  value={entry.rate ?? ""}
                  onChange={(rate) => change(index, { rate: rate || null })}
                />
                <TextField
                  label={`费用 ${index + 1} 汇率日期`}
                  type="date"
                  value={entry.rateOn ?? ""}
                  onChange={(rateOn) =>
                    change(index, { rateOn: rateOn || null })
                  }
                />
              </>
            )}
          </div>
          <TextField
            label={`费用 ${index + 1} 备注`}
            multiline
            value={entry.notes}
            onChange={(notes) => change(index, { notes })}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={entry.confirmed}
                onChange={(e) => change(index, { confirmed: e.target.checked })}
              />
              已确认此笔金额（非参考价）
            </label>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEntries(entries.filter((_, i) => i !== index));
                setComplete(false);
              }}
            >
              移除费用 {index + 1}
            </Button>
          </div>
        </fieldset>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setEntries([
            ...entries,
            {
              category: "other",
              amount: "",
              currency: order.quote.currency,
              occurredOn: localDateValue(),
              notes: "",
              supplierId: null,
              supplierName: "",
              productId: null,
              offerId: null,
              rate: null,
              rateOn: null,
              confirmed: false,
            },
          ]);
          setComplete(false);
        }}
        disabled={entries.length >= 200}
      >
        新增费用
      </Button>
      <div className="space-y-3 rounded-lg border p-4">
        <label className="flex items-start gap-2 text-sm leading-6">
          <input
            type="checkbox"
            className="mt-1"
            checked={complete}
            onChange={(e) => setComplete(e.target.checked)}
          />
          我已核对商品采购、运费、税费及其他费用全部录齐；没有录入的类别明确为零，不是未知。
        </label>
        <TextField
          label={complete ? "成本完整确认说明 *" : "成本完整确认说明"}
          value={note}
          onChange={setNote}
          required={complete}
          hint="外币缺汇率时即使金额已录齐，利润仍待计算。"
        />
      </div>
      <TextField
        label="本次成本录入/更正原因 *"
        value={reason}
        onChange={setReason}
        required
      />
    </SaveForm>
  );
}
function History({ order }: { order: Order }) {
  const [events, setEvents] = useState<OrderEvent[] | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setEvents(null);
    setError("");
    getOrderHistory(order.id).then(
      (events) => {
        if (!cancelled) setEvents(events);
      },
      (error) => {
        if (!cancelled) setError(messageOf(error));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [order.id, order.version, attempt]);
  return (
    <div className="space-y-3">
      <ErrorMessage message={error} />
      {error ? (
        <Button variant="outline" onClick={() => setAttempt((v) => v + 1)}>
          重试读取历史
        </Button>
      ) : events === null ? (
        <p role="status" className="text-sm">
          正在读取更正历史…
        </p>
      ) : (
        events.map((event) => (
          <details key={event.id} className="rounded-lg border p-3">
            <summary className="cursor-pointer text-sm leading-6">
              {event.occurredAt} · {event.action} · 版本{" "}
              {event.snapshot.version}
            </summary>
            <div className="mt-4 space-y-4">
              <p className="text-sm">
                订单日期：{event.snapshot.orderedOn} ·{" "}
                {orderStatuses[event.snapshot.status]} · 来源{" "}
                {event.snapshot.quote.number}
              </p>
              <QuoteView quote={event.snapshot.quote} />
              <ProfitView order={event.snapshot} />
              <CostList
                entries={event.snapshot.costs}
                currency={event.snapshot.quote.currency}
              />
            </div>
          </details>
        ))
      )}
    </div>
  );
}
export function Orders({
  snapshot,
  business,
  refresh,
  navigate,
  route,
}: Props) {
  const [customer, setCustomer] = useState(route.customerId?.toString() ?? "");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [through, setThrough] = useState("");
  const [editor, setEditor] = useState<
    "draft" | "costs" | "confirmed" | "cancelled" | null
  >(null);
  const order = snapshot.orders.find((o) => o.id === route.id);
  const items = snapshot.orders.filter(
    (o) =>
      (!customer || o.quote.customerId === Number(customer)) &&
      (!status || o.status === status) &&
      (!from || o.orderedOn >= from) &&
      (!through || o.orderedOn <= through),
  );
  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-2">
        <Field label="按客户筛选订单">
          {(id) => (
            <select
              id={id}
              className={fieldClass}
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
            >
              <option value="">全部客户</option>
              {business.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="订单状态">
          {(id) => (
            <select
              id={id}
              className={fieldClass}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">全部状态</option>
              {Object.entries(orderStatuses).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </select>
          )}
        </Field>
        <TextField
          label="订单开始日期（含）"
          type="date"
          value={from}
          onChange={setFrom}
        />
        <TextField
          label="订单结束日期（含）"
          type="date"
          value={through}
          onChange={setThrough}
        />
      </div>
      <Button
        variant="outline"
        onClick={() => {
          setCustomer("");
          setStatus("");
          setFrom("");
          setThrough("");
        }}
      >
        清除订单筛选
      </Button>
      {from && through && from > through && (
        <ErrorMessage message="开始日期不能晚于结束日期。" />
      )}
      {order && (
        <Card className="shadow-none">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-3">
              <CardTitle>{order.number}</CardTitle>
              <Badge variant="outline">{orderStatuses[order.status]}</Badge>
              <span className="text-sm text-muted-foreground">
                {order.orderedOn} · 版本 {order.version}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {editor === "draft" ? (
              <OrderEditor
                key={`${order.id}-edit`}
                order={order}
                snapshot={snapshot}
                refresh={refresh}
                done={() => setEditor(null)}
              />
            ) : editor === "costs" ? (
              <CostsForm
                key={`${order.id}-cost`}
                order={order}
                snapshot={snapshot}
                refresh={refresh}
                done={() => setEditor(null)}
              />
            ) : editor ? (
              <StatusForm
                key={editor}
                order={order}
                status={editor}
                refresh={refresh}
                done={() => setEditor(null)}
              />
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      navigate({ kind: "quotes", id: order.sourceQuoteId })
                    }
                  >
                    查看来源报价 {order.quote.number}
                  </Button>
                  {order.status === "draft" && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => setEditor("draft")}
                      >
                        更正草稿
                      </Button>
                      <Button onClick={() => setEditor("confirmed")}>
                        确认订单
                      </Button>
                    </>
                  )}
                  {order.status !== "cancelled" && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => setEditor("costs")}
                      >
                        录入 / 更正成本
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => setEditor("cancelled")}
                      >
                        取消订单
                      </Button>
                    </>
                  )}
                </div>
                <p className="text-sm">
                  承诺交付日期：{order.deliveryOn ?? "尚未确定"}
                </p>
                {order.notes && (
                  <p className="text-sm whitespace-pre-wrap">{order.notes}</p>
                )}
                <ProfitView order={order} />
                <details>
                  <summary className="cursor-pointer text-sm font-medium">
                    查看交易明细快照
                  </summary>
                  <div className="mt-4">
                    <QuoteView quote={order.quote} />
                  </div>
                </details>
                <CostList
                  entries={order.costs}
                  currency={order.quote.currency}
                />
                <details>
                  <summary className="cursor-pointer text-sm font-medium">
                    状态与成本更正历史
                  </summary>
                  <div className="mt-4">
                    <History order={order} />
                  </div>
                </details>
              </>
            )}
          </CardContent>
        </Card>
      )}
      <div className="space-y-2">
        {items.length ? (
          items.map((o) => (
            <button
              key={o.id}
              className="flex w-full flex-wrap justify-between gap-3 rounded-lg border bg-card p-4 text-left text-sm focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => {
                setEditor(null);
                navigate({ kind: "orders", id: o.id });
              }}
            >
              <span className="font-medium">
                {o.number} · {o.quote.customer.name}
              </span>
              <span>
                {o.orderedOn} · {orderStatuses[o.status]} · {o.quote.currency}{" "}
                {o.quote.total}
              </span>
            </button>
          ))
        ) : (
          <Empty>
            {snapshot.orders.length
              ? "筛选无结果，请调整或清除筛选。"
              : "还没有订单，请从已保存的结构化报价生成订单。"}
          </Empty>
        )}
      </div>
    </div>
  );
}
