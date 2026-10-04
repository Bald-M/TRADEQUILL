import { SelectInput } from "./Shared";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { localDateValue, type BusinessSnapshot } from "@/lib/business";
import {
  getOrderReport,
  type CommerceRoute,
  type OrderReport,
  type ReportFilter,
  type ReportTotals,
} from "@/lib/commerce";
import { Empty, ErrorMessage, Field, TextField, messageOf } from "./Shared";

function Totals({
  title,
  totals,
  currency,
  onDrill,
}: {
  title: string;
  totals: ReportTotals;
  currency: string;
  onDrill: (ids: number[]) => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <h4 className="font-medium">
        {title} · {totals.orderIds.length} 单
      </h4>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt>相应收入</dt>
        <dd>{totals.revenue}</dd>
        <dt>商品采购</dt>
        <dd>{totals.purchase}</dd>
        <dt>支出运费</dt>
        <dd>{totals.freight}</dd>
        <dt>支出税费</dt>
        <dd>{totals.tax}</dd>
        <dt>其他费用</dt>
        <dd>{totals.other}</dd>
        <dt>费用合计</dt>
        <dd>{totals.totalCost}</dd>
        <dt>利润</dt>
        <dd className="font-semibold">{totals.profit}</dd>
        <dt>总利润率</dt>
        <dd>
          {totals.margin === null ? "不适用（零收入）" : `${totals.margin}%`}
        </dd>
      </dl>
      <Button
        size="sm"
        variant="outline"
        disabled={!totals.orderIds.length}
        onClick={() => onDrill(totals.orderIds)}
      >
        下钻 {currency} {title}
      </Button>
    </div>
  );
}
export function Reports({
  business,
  refreshVersion,
  navigate,
}: {
  business: BusinessSnapshot;
  refreshVersion: unknown;
  navigate: (route: CommerceRoute) => void;
}) {
  const today = localDateValue();
  const [form, setForm] = useState<ReportFilter>({
    from: `${today.slice(0, 7)}-01`,
    through: today,
    customerId: null,
  });
  const [filter, setFilter] = useState(form);
  const [report, setReport] = useState<OrderReport | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [drill, setDrill] = useState<number[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    setReport(null);
    setError("");
    setDrill(null);
    getOrderReport(filter).then(
      (data) => {
        if (!cancelled) setReport(data);
      },
      (error) => {
        if (!cancelled) setError(messageOf(error));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [filter, attempt, refreshVersion]);
  const orders =
    report?.orders.filter(
      (order) => drill === null || drill.includes(order.id),
    ) ?? [];
  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-muted-foreground">
        按订单日期的闭区间统计已确认订单，排除草稿与取消；报价不计收入。币种分别汇总，成本已确认与暂估分开。暂不支持退款/退货。总利润率按该组总利润
        / 该组总收入计算。
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setFilter({ ...form });
        }}
        className="space-y-3"
      >
        <div className="grid gap-3 lg:grid-cols-2">
          <TextField
            label="开始日期（含）*"
            type="date"
            value={form.from}
            onChange={(from) => setForm({ ...form, from })}
            required
          />
          <TextField
            label="结束日期（含）*"
            type="date"
            value={form.through}
            onChange={(through) => setForm({ ...form, through })}
            required
          />
          <Field label="统计客户">
            {(id) => (
              <SelectInput
                id={id}
                value={String(form.customerId ?? "")}
                onValueChange={(value) =>
                  setForm({
                    ...form,
                    customerId: value ? Number(value) : null,
                  })
                }
                options={[
                  { value: String(""), label: String("全部客户") },
                  ...business.customers.map((c) => ({
                    value: String(c.id),
                    label: String(c.name),
                  })),
                ]}
              />
            )}
          </Field>
          <TextField
            label="快速选择月份"
            type="month"
            value={form.from.slice(0, 7)}
            onChange={(value) => {
              if (!/^\d{4}-\d{2}$/.test(value)) return;
              const [year, month] = value.split("-").map(Number);
              setForm({
                ...form,
                from: `${value}-01`,
                through: localDateValue(new Date(year, month, 0)),
              });
            }}
          />
        </div>
        <Button type="submit">应用统计范围</Button>
      </form>
      <ErrorMessage message={error} />
      {error ? (
        <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>
          重试统计
        </Button>
      ) : report === null ? (
        <p role="status" className="text-sm">
          正在计算经营统计…
        </p>
      ) : (
        <>
          <Card className="shadow-none">
            <CardContent className="space-y-2 pt-5 text-sm">
              <p className="font-medium">
                实际统计范围：{report.from} 至 {report.through}（含两端）
              </p>
              <p>
                纳入 {report.includedCount} 单 · 成本未完整{" "}
                {report.incompleteCount} 单 · 汇率缺失 {report.missingRateCount}{" "}
                单
              </p>
              <p className="text-muted-foreground">
                修改上方条件后点击“应用统计范围”。所有下钻明细均来自这里显示的同一范围。
              </p>
            </CardContent>
          </Card>
          {report.currencies.length ? (
            report.currencies.map((group) => (
              <Card key={group.currency} className="shadow-none">
                <CardHeader>
                  <CardTitle>
                    {group.currency} · 销售收入 {group.revenue}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm">
                    {group.orderIds.length} 单 · 成本未完整{" "}
                    {group.incompleteCount} · 缺汇率 {group.missingRateCount} ·
                    利润待计算 {group.uncomputedCount}
                  </p>
                  <div className="grid gap-4 xl:grid-cols-2">
                    <Totals
                      title="成本已完整确认"
                      totals={group.confirmed}
                      currency={group.currency}
                      onDrill={setDrill}
                    />
                    <Totals
                      title="暂估，成本未完整"
                      totals={group.estimated}
                      currency={group.currency}
                      onDrill={setDrill}
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setDrill(group.orderIds)}
                  >
                    下钻全部 {group.currency} 订单
                  </Button>
                </CardContent>
              </Card>
            ))
          ) : (
            <Empty>所选期间与客户没有已确认订单。</Empty>
          )}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-medium">构成订单 · {orders.length} 单</h3>
              {drill && (
                <Button variant="outline" onClick={() => setDrill(null)}>
                  显示本期间全部订单
                </Button>
              )}
            </div>
            {orders.map((order) => (
              <button
                key={order.id}
                className="flex w-full flex-wrap justify-between gap-3 rounded-lg border p-4 text-left text-sm focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => navigate({ kind: "orders", id: order.id })}
              >
                <span className="font-medium">
                  {order.number} · {order.quote.customer.name} ·{" "}
                  {order.orderedOn}
                </span>
                <span>
                  {order.quote.currency} 收入 {order.quote.total} ·{" "}
                  {order.profit.complete ? "利润" : "暂估利润"}{" "}
                  {order.profit.profit ?? "待计算"}
                </span>
              </button>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
