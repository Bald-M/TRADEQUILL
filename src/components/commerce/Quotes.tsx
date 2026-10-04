import { SelectInput } from "./Shared";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  currencies,
  localDateValue,
  type BusinessSnapshot,
} from "@/lib/business";
import {
  createOrder,
  exportQuotePdf,
  productText,
  saveSeller,
  saveStructuredQuote,
  type CommerceRoute,
  type CommerceSnapshot,
  type QuoteDocument,
  type QuoteFields,
} from "@/lib/commerce";
import { ActionButton, Empty, Field, SaveForm, TextField } from "./Shared";
import { ProductFieldsEditor } from "./Catalog";

type Props = {
  snapshot: CommerceSnapshot;
  business: BusinessSnapshot;
  refresh: () => Promise<void>;
  navigate: (route: CommerceRoute) => void;
  route: CommerceRoute;
};
export function QuoteView({ quote }: { quote: QuoteDocument }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">{quote.number}</h3>
        <Badge variant="outline">修订 {quote.revision}</Badge>
      </div>
      <p className="text-sm leading-6 whitespace-pre-wrap">{quote.seller}</p>
      <div className="grid gap-3 text-sm lg:grid-cols-2">
        <p>
          客户 / Customer：{quote.customer.name}
          <br />
          {quote.customer.company}
          <br />
          {quote.customer.email}
          <br />
          {quote.customer.phone}
        </p>
        <p>
          报价日期 / Date：{quote.quotedOn}
          <br />
          有效期 / Valid until：{quote.validUntil}
          <br />
          币种 / Currency：{quote.currency}
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-96 text-left text-sm">
          <caption className="sr-only">报价商品明细</caption>
          <thead className="bg-muted">
            <tr>
              <th className="p-3">产品 / Product</th>
              <th className="p-3">数量</th>
              <th className="p-3">单价</th>
              <th className="p-3">金额</th>
            </tr>
          </thead>
          <tbody>
            {quote.lines.map((line, index) => (
              <tr key={index} className="border-t align-top">
                <td className="max-w-80 p-3 break-words whitespace-pre-wrap">
                  {productText(line.product)}
                  {quote.belowMoq.includes(index) && (
                    <p className="mt-2 font-medium">低于 MOQ，需与客户确认</p>
                  )}
                </td>
                <td className="p-3 tabular-nums">
                  {line.quantity} {line.product.unit}
                </td>
                <td className="p-3 tabular-nums">{line.unitPrice}</td>
                <td className="p-3 tabular-nums">{quote.lineAmounts[index]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="ml-auto grid max-w-sm grid-cols-2 gap-2 text-sm">
        <dt>商品小计 / Subtotal</dt>
        <dd className="text-right tabular-nums">{quote.subtotal}</dd>
        <dt>折扣 / Discount</dt>
        <dd className="text-right">−{quote.discount}</dd>
        <dt>税费 / Tax</dt>
        <dd className="text-right">{quote.tax}</dd>
        <dt>运费 / Freight</dt>
        <dd className="text-right">{quote.freight}</dd>
        <dt className="border-t pt-2 font-semibold">合计 / Total</dt>
        <dd className="border-t pt-2 text-right font-semibold">
          {quote.currency} {quote.total}
        </dd>
      </dl>
      <div>
        <h4 className="text-sm font-medium">约定条款 / Terms</h4>
        <p className="mt-2 text-sm leading-6 whitespace-pre-wrap">
          {quote.terms}
        </p>
      </div>
    </div>
  );
}
function SellerForm({
  seller,
  refresh,
  done,
}: {
  seller: string;
  refresh: () => Promise<void>;
  done: () => void;
}) {
  const [value, setValue] = useState(seller);
  return (
    <SaveForm
      save={() => saveSeller(value)}
      refresh={refresh}
      onDone={done}
      onCancel={done}
    >
      <TextField
        label="默认公司抬头与联系方式 *"
        hint="用于新报价；修改不会改写历史报价。建议填写中英文名称。"
        value={value}
        onChange={setValue}
        multiline
        required
      />
    </SaveForm>
  );
}
function QuoteForm({
  snapshot,
  business,
  refresh,
  navigate,
  route,
  previous,
  done,
}: Props & { previous?: QuoteDocument; done: () => void }) {
  const legacy = business.quotes.find((q) => q.id === route.legacyId);
  const [form, setForm] = useState<QuoteFields>(() =>
    previous
      ? structuredClone(previous)
      : {
          customerId:
            route.customerId ??
            legacy?.customerId ??
            business.customers[0]?.id ??
            0,
          inquiryId: legacy?.inquiryId ?? null,
          quotedOn: localDateValue(),
          validUntil: "",
          seller: snapshot.seller,
          terms: "",
          currency: legacy?.currency ?? "USD",
          discount: "0",
          tax: "0",
          freight: "0",
          lines: [],
        },
  );
  const [selectedProduct, setSelectedProduct] = useState(0);
  const [query, setQuery] = useState("");
  const [requestKey] = useState(() => crypto.randomUUID());
  const savedId = useRef<number | null>(null);
  const products = snapshot.products.filter(
    (p) =>
      !p.archived &&
      `${p.code} ${p.name}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  const set = <K extends keyof QuoteFields>(key: K, value: QuoteFields[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  return (
    <SaveForm
      label="保存并预览报价"
      save={async () => {
        savedId.current = await saveStructuredQuote({
          ...form,
          requestKey,
          previousQuoteId: previous?.quoteId ?? legacy?.id ?? null,
        });
      }}
      refresh={refresh}
      onDone={() => {
        done();
        navigate({ kind: "quotes", id: savedId.current ?? undefined });
      }}
      onCancel={done}
    >
      {legacy && (
        <div className="rounded-lg border bg-muted p-3 text-sm">
          <p>
            从旧报价补齐明细。原记录、金额与文字保留，不自动猜测数量或单价。
          </p>
          <p className="mt-2 whitespace-pre-wrap">原文：{legacy.content}</p>
          <p>
            原金额：{legacy.currency} {legacy.amount}
          </p>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="客户 *">
          {(id) => (
            <SelectInput
              id={id}
              value={String(form.customerId)}
              disabled={!!previous || !!legacy}
              onValueChange={(value) =>
                setForm({
                  ...form,
                  customerId: Number(value),
                  inquiryId: null,
                })
              }
              options={[
                { value: String(0), label: String("选择客户") },
                ...business.customers.map((c) => ({
                  value: String(c.id),
                  label: [c.name, "·", c.company].join(""),
                })),
              ]}
            />
          )}
        </Field>
        <Field label="关联询盘">
          {(id) => (
            <SelectInput
              id={id}
              value={String(form.inquiryId ?? "")}
              onValueChange={(value) =>
                set("inquiryId", value ? Number(value) : null)
              }
              options={[
                { value: String(""), label: String("不关联询盘") },
                ...business.inquiries
                  .filter((i) => i.customerId === form.customerId)
                  .map((i) => ({
                    value: String(i.id),
                    label: [i.receivedOn, "·", i.content.slice(0, 60)].join(""),
                  })),
              ]}
            />
          )}
        </Field>
        <TextField
          label="报价日期 *"
          type="date"
          value={form.quotedOn}
          onChange={(v) => set("quotedOn", v)}
          required
        />
        <TextField
          label="有效期 *"
          type="date"
          value={form.validUntil}
          onChange={(v) => set("validUntil", v)}
          required
        />
      </div>
      <TextField
        label="本次报价公司抬头 *"
        value={form.seller}
        onChange={(v) => set("seller", v)}
        multiline
        required
      />
      <fieldset className="space-y-4 rounded-lg border p-4">
        <legend className="px-2 font-medium">选品与明细</legend>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-40 flex-1">
            <TextField label="检索产品" value={query} onChange={setQuery} />
          </div>
          <div className="min-w-40 flex-1">
            <Field label="添加产品">
              {(id) => (
                <SelectInput
                  id={id}
                  value={String(selectedProduct)}
                  onValueChange={(value) => setSelectedProduct(Number(value))}
                  options={[
                    { value: String(0), label: String("选择产品") },
                    ...products.map((p) => ({
                      value: String(p.id),
                      label: [p.code, "·", p.name].join(""),
                    })),
                  ]}
                />
              )}
            </Field>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={!selectedProduct || form.lines.length >= 100}
            onClick={() => {
              const product = snapshot.products.find(
                (p) => p.id === selectedProduct && !p.archived,
              );
              if (product)
                set("lines", [
                  ...form.lines,
                  {
                    productId: product.id,
                    product: structuredClone(product),
                    quantity: product.moq ?? "1",
                    unitPrice: "",
                  },
                ]);
            }}
          >
            加入明细
          </Button>
        </div>
        {!form.lines.length && (
          <Empty>
            从产品档案选择一项或多项产品；保存时必须补齐数量和单价。
          </Empty>
        )}
        {form.lines.map((line, index) => (
          <section key={index} className="space-y-3 rounded-lg border p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-medium">
                {index + 1}. {line.product.code} · {line.product.name}
              </h3>
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  set(
                    "lines",
                    form.lines.filter((_, i) => i !== index),
                  )
                }
              >
                移除明细 {index + 1}
              </Button>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <TextField
                label={`明细 ${index + 1} 数量 *`}
                hint={`最多 3 位小数；MOQ ${line.product.moq ?? "未知"} ${line.product.unit}`}
                value={line.quantity}
                onChange={(quantity) =>
                  set(
                    "lines",
                    form.lines.map((l, i) =>
                      i === index ? { ...l, quantity } : l,
                    ),
                  )
                }
                required
              />
              <TextField
                label={`明细 ${index + 1} 单价 *`}
                hint="最多 4 位小数；可填写 0"
                value={line.unitPrice}
                onChange={(unitPrice) =>
                  set(
                    "lines",
                    form.lines.map((l, i) =>
                      i === index ? { ...l, unitPrice } : l,
                    ),
                  )
                }
                required
              />
            </div>
            <details>
              <summary className="cursor-pointer text-sm underline">
                调整本次报价的产品资料（不改档案）
              </summary>
              <div className="mt-3">
                <ProductFieldsEditor
                  value={line.product}
                  onChange={(product) =>
                    set(
                      "lines",
                      form.lines.map((l, i) =>
                        i === index ? { ...l, product } : l,
                      ),
                    )
                  }
                />
              </div>
            </details>
          </section>
        ))}
      </fieldset>
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="报价币种">
          {(id) => (
            <SelectInput
              id={id}
              value={String(form.currency)}
              onValueChange={(value) => set("currency", value)}
              options={[
                ...currencies.map((c) => ({
                  value: String(String(c)),
                  label: String(c),
                })),
              ]}
            />
          )}
        </Field>
        {(
          [
            ["discount", "折扣金额"],
            ["tax", "向客户收取的税费"],
            ["freight", "向客户收取的运费"],
          ] as const
        ).map(([key, label]) => (
          <TextField
            key={key}
            label={`${label} *`}
            value={form[key]}
            onChange={(v) => set(key, v)}
            hint={form.currency === "JPY" ? "日元按整数金额" : "最多 2 位小数"}
            required
          />
        ))}
      </div>
      <TextField
        label="贸易及商业条款 *"
        hint="填写贸易术语、交货地点、付款和其他约定。税费为手工金额；不自动判断税率。"
        value={form.terms}
        onChange={(v) => set("terms", v)}
        multiline
        required
      />
      <p className="text-sm leading-6 text-muted-foreground">
        行金额先按币种最小单位四舍五入，再求和。合计 = 商品小计 − 折扣 + 税费 +
        向客户收取的运费。保存后显示精确合计与 MOQ 提示。
      </p>
    </SaveForm>
  );
}
export function Quotes(props: Props) {
  const { snapshot, business, refresh, navigate, route } = props;
  const [customerId, setCustomerId] = useState(
    route.customerId?.toString() ?? "",
  );
  const [editing, setEditing] = useState(route.newQuote ?? false);
  const [revision, setRevision] = useState<QuoteDocument>();
  const [sellerEditing, setSellerEditing] = useState(false);
  const [orderedOn, setOrderedOn] = useState(localDateValue());
  const quote = snapshot.quotes.find((q) => q.quoteId === route.id);
  const quotes = snapshot.quotes.filter(
    (q) => !customerId || q.customerId === Number(customerId),
  );
  const legacy = business.quotes.filter(
    (q) =>
      (!customerId || q.customerId === Number(customerId)) &&
      !snapshot.quotes.some(
        (s) => s.quoteId === q.id || s.previousQuoteId === q.id,
      ),
  );
  if (sellerEditing)
    return (
      <Card className="shadow-none">
        <CardContent className="pt-5">
          <SellerForm
            seller={snapshot.seller}
            refresh={refresh}
            done={() => setSellerEditing(false)}
          />
        </CardContent>
      </Card>
    );
  return (
    <div className="space-y-4">
      {editing ? (
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>
              {revision ? `修订 ${revision.number}` : "选品生成报价"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <QuoteForm
              {...props}
              previous={revision}
              done={() => {
                setEditing(false);
                setRevision(undefined);
              }}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-48 flex-1">
              <Field label="按客户筛选报价">
                {(id) => (
                  <SelectInput
                    id={id}
                    value={String(customerId)}
                    onValueChange={(value) => setCustomerId(value)}
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
            </div>
            <Button
              variant="outline"
              onClick={() => setSellerEditing(!sellerEditing)}
            >
              设置公司抬头
            </Button>
            <Button
              onClick={() => {
                setRevision(undefined);
                setEditing(true);
              }}
            >
              选品生成报价
            </Button>
          </div>
          {quote && (
            <Card className="shadow-none">
              <CardContent className="space-y-5 pt-5">
                <QuoteView quote={quote} />
                <div className="flex flex-wrap items-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setRevision(quote);
                      setEditing(true);
                    }}
                  >
                    创建商业修订
                  </Button>
                  <QuoteExport quoteId={quote.quoteId} />
                  <div className="w-44">
                    <TextField
                      label="转订单日期"
                      type="date"
                      value={orderedOn}
                      onChange={setOrderedOn}
                    />
                  </div>
                  <ActionButton
                    variant="default"
                    action={async () => {
                      const id = await createOrder(quote.quoteId, orderedOn);
                      await refresh();
                      navigate({ kind: "orders", id });
                    }}
                  >
                    从此版本生成订单
                  </ActionButton>
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                  {snapshot.quotes
                    .filter((q) => q.seriesId === quote.seriesId)
                    .map((q) => (
                      <Button
                        key={q.quoteId}
                        size="sm"
                        variant={
                          q.quoteId === quote.quoteId ? "default" : "outline"
                        }
                        onClick={() =>
                          navigate({ kind: "quotes", id: q.quoteId })
                        }
                      >
                        修订 {q.revision}
                      </Button>
                    ))}
                  {snapshot.orders
                    .filter((o) => o.quote.seriesId === quote.seriesId)
                    .map((o) => (
                      <Button
                        key={o.id}
                        size="sm"
                        variant="outline"
                        onClick={() => navigate({ kind: "orders", id: o.id })}
                      >
                        关联订单 {o.number}
                      </Button>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
          <div className="space-y-2">
            {quotes.map((q) => (
              <button
                key={q.quoteId}
                className="flex w-full flex-wrap justify-between gap-2 rounded-lg border bg-card p-4 text-left text-sm focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => navigate({ kind: "quotes", id: q.quoteId })}
              >
                <span className="font-medium">
                  {q.number} · {q.customer.name}
                </span>
                <span>
                  {q.quotedOn} · {q.currency} {q.total}
                </span>
              </button>
            ))}
            {!quotes.length && (
              <Empty>
                {snapshot.quotes.length
                  ? "该客户没有结构化报价，可调整筛选。"
                  : "保存产品档案后，选品生成第一份结构化报价。"}
              </Empty>
            )}
          </div>
          {legacy.length > 0 && (
            <section className="space-y-3">
              <h3 className="font-medium">历史简单报价</h3>
              {legacy.map((q) => (
                <article
                  key={q.id}
                  className="space-y-2 rounded-lg border p-4 text-sm"
                >
                  <p className="font-medium">
                    {q.quotedOn} ·{" "}
                    {
                      business.customers.find((c) => c.id === q.customerId)
                        ?.name
                    }{" "}
                    · {q.currency} {q.amount}
                  </p>
                  <p className="whitespace-pre-wrap">{q.content}</p>
                  <p className="text-muted-foreground">
                    旧记录继续在客户卡片编辑；转订单前须补齐明细。
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      navigate({
                        kind: "quotes",
                        newQuote: true,
                        legacyId: q.id,
                        customerId: q.customerId,
                      })
                    }
                  >
                    补齐明细生成报价
                  </Button>
                </article>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

// Export is a dedicated native command; the UI cannot choose arbitrary file paths.
function QuoteExport({ quoteId }: { quoteId: number }) {
  const [result, setResult] = useState("");
  return (
    <div className="space-y-2">
      <ActionButton
        action={async () => {
          const result = await exportQuotePdf(quoteId);
          setResult(
            result ? `PDF 已保存：${result}` : "已取消导出，可随时重试。",
          );
        }}
      >
        导出中英双语 PDF
      </ActionButton>
      {result && (
        <p role="status" className="max-w-80 text-xs break-words">
          {result}
        </p>
      )}
    </div>
  );
}
