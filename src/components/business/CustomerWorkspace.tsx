import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  FileText,
  Inbox,
  Mail,
  MapPin,
  Package,
  Pencil,
  Phone,
  Plus,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CustomerForm,
  InquiryForm,
  QuoteForm,
  SampleForm,
  SampleProgressForm,
  ShipmentForm,
  TaskForm,
  fieldClass,
} from "@/components/business/BusinessForms";
import {
  filterInquiries,
  followUpStages,
  sampleStageLabel,
  setFollowUpTaskCompleted,
  stageLabel,
  type BusinessSnapshot,
  type InquiryFilters,
} from "@/lib/business";

type Section = "inquiries" | "quotes" | "samples" | "tasks";
type Editor = { kind: "customer" | Section; id?: number } | null;

const emptyFilters: InquiryFilters = {
  source: "",
  country: "",
  product: "",
  stage: "",
};

function distinct(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "zh-CN"),
  );
}

function Empty({ children }: { children: string }) {
  return (
    <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

export function CustomerWorkspace({
  snapshot,
  refresh,
}: {
  snapshot: BusinessSnapshot;
  refresh: () => Promise<void>;
}) {
  const [filters, setFilters] = useState<InquiryFilters>(emptyFilters);
  const [selectedId, setSelectedId] = useState<number | null>(
    snapshot.customers[0]?.id ?? null,
  );
  const [section, setSection] = useState<Section>("inquiries");
  const [editor, setEditor] = useState<Editor>(null);
  const [actionError, setActionError] = useState("");
  const [busyTask, setBusyTask] = useState<number | null>(null);
  const [committedTask, setCommittedTask] = useState<{
    id: number;
    completed: boolean;
  } | null>(null);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const filtersActive = Object.values(filters).some(Boolean);
  const matchingInquiries = useMemo(
    () => filterInquiries(snapshot.inquiries, filters),
    [snapshot.inquiries, filters],
  );
  const matchingCustomerIds = new Set(
    matchingInquiries.map((inquiry) => inquiry.customerId),
  );
  const customers = filtersActive
    ? snapshot.customers.filter((customer) =>
        matchingCustomerIds.has(customer.id),
      )
    : snapshot.customers;

  useEffect(() => {
    if (
      selectedId !== null &&
      customers.some((customer) => customer.id === selectedId)
    )
      return;
    setSelectedId(customers[0]?.id ?? null);
    setEditor(null);
  }, [customers, selectedId]);

  useEffect(() => {
    if (
      committedTask &&
      snapshot.tasks.some(
        (task) =>
          task.id === committedTask.id &&
          task.completed === committedTask.completed,
      )
    ) {
      setCommittedTask(null);
      setRefreshFailed(false);
      setActionError("");
    }
  }, [committedTask, snapshot.tasks]);

  const customer = snapshot.customers.find((item) => item.id === selectedId);
  const allCustomerInquiries = snapshot.inquiries.filter(
    (item) => item.customerId === selectedId,
  );
  const inquiries = filtersActive
    ? matchingInquiries.filter((item) => item.customerId === selectedId)
    : allCustomerInquiries;
  const quotes = snapshot.quotes.filter(
    (item) => item.customerId === selectedId,
  );
  const samples = snapshot.samples.filter(
    (item) => item.customerId === selectedId,
  );
  const tasks = snapshot.tasks.filter((item) => item.customerId === selectedId);

  const options = {
    sources: distinct(snapshot.inquiries.map((item) => item.source)),
    countries: distinct(snapshot.inquiries.map((item) => item.country)),
    products: distinct(snapshot.inquiries.flatMap((item) => item.products)),
  };

  async function saved() {
    await refresh();
    setEditor(null);
  }

  async function toggleTask(taskId: number, completed: boolean) {
    setBusyTask(taskId);
    setActionError("");
    setRefreshFailed(false);
    try {
      await setFollowUpTaskCompleted(taskId, completed);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
      setBusyTask(null);
      return;
    }
    setCommittedTask({ id: taskId, completed });
    try {
      await refresh();
    } catch (error) {
      setRefreshFailed(true);
      setActionError(
        `任务状态已更新，但界面刷新失败：${error instanceof Error ? error.message : String(error)}。`,
      );
    } finally {
      setBusyTask(null);
    }
  }

  async function retryRefresh() {
    setRefreshing(true);
    try {
      await refresh();
    } catch (error) {
      setActionError(
        `任务状态已更新，但界面刷新失败：${error instanceof Error ? error.message : String(error)}。`,
      );
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="shadow-none">
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-medium">询盘分类筛选</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                来源、国家、产品和阶段可组合使用。
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilters(emptyFilters)}
              disabled={!filtersActive}
            >
              <X aria-hidden="true" /> 清除筛选
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <select
              aria-label="按询盘来源筛选"
              value={filters.source}
              onChange={(event) =>
                setFilters({ ...filters, source: event.target.value })
              }
              className={fieldClass}
            >
              <option value="">全部来源</option>
              {options.sources.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <select
              aria-label="按国家或地区筛选"
              value={filters.country}
              onChange={(event) =>
                setFilters({ ...filters, country: event.target.value })
              }
              className={fieldClass}
            >
              <option value="">全部国家或地区</option>
              {options.countries.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <select
              aria-label="按意向产品筛选"
              value={filters.product}
              onChange={(event) =>
                setFilters({ ...filters, product: event.target.value })
              }
              className={fieldClass}
            >
              <option value="">全部产品</option>
              {options.products.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <select
              aria-label="按跟进阶段筛选"
              value={filters.stage}
              onChange={(event) =>
                setFilters({ ...filters, stage: event.target.value })
              }
              className={fieldClass}
            >
              <option value="">全部阶段</option>
              {followUpStages.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="grid min-h-[31rem] gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <Card className="h-fit shadow-none">
          <CardHeader className="flex-row items-center justify-between space-y-0 p-4">
            <CardTitle className="text-base">客户</CardTitle>
            <Button size="sm" onClick={() => setEditor({ kind: "customer" })}>
              <Plus aria-hidden="true" /> 新建
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 p-2 pt-0">
            {snapshot.customers.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                还没有客户，先新建一份客户档案。
              </p>
            ) : customers.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                <p>没有符合组合筛选的客户。</p>
                <Button variant="link" onClick={() => setFilters(emptyFilters)}>
                  清除筛选
                </Button>
              </div>
            ) : (
              customers.map((item) => {
                const count = matchingInquiries.filter(
                  (inquiry) => inquiry.customerId === item.id,
                ).length;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(item.id);
                      setEditor(null);
                    }}
                    className={`w-full rounded-md border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring ${selectedId === item.id ? "bg-secondary" : "hover:bg-muted"}`}
                  >
                    <span className="block truncate text-sm font-medium">
                      {item.name}
                    </span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">
                      {item.company || item.country || "未填写公司或地区"}
                    </span>
                    {filtersActive && (
                      <span className="mt-2 block text-xs">
                        匹配 {count} 条询盘
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-4">
          {editor?.kind === "customer" && !editor.id && (
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle className="text-base">新建客户</CardTitle>
              </CardHeader>
              <CardContent>
                <CustomerForm
                  key="new-customer"
                  onSaved={async () => {
                    await refresh();
                    setEditor(null);
                  }}
                  onCancel={() => setEditor(null)}
                />
              </CardContent>
            </Card>
          )}

          {!customer ? (
            <Empty>
              {filtersActive
                ? "筛选结果为空，请调整或清除筛选。"
                : "新建客户后，可在客户卡片统一维护询盘、报价、样品和跟进。"}
            </Empty>
          ) : (
            <>
              <Card className="shadow-none">
                <CardContent className="p-5">
                  {editor?.kind === "customer" && editor.id === customer.id ? (
                    <CustomerForm
                      key={`customer-${customer.id}`}
                      customer={customer}
                      onSaved={saved}
                      onCancel={() => setEditor(null)}
                    />
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-semibold">
                            {customer.name}
                          </h2>
                          {customer.company && (
                            <Badge variant="secondary">
                              {customer.company}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                          {customer.country && (
                            <span className="flex items-center gap-1.5">
                              <MapPin className="size-4" aria-hidden="true" />
                              {customer.country}
                            </span>
                          )}
                          {customer.email && (
                            <span className="flex items-center gap-1.5">
                              <Mail className="size-4" aria-hidden="true" />
                              {customer.email}
                            </span>
                          )}
                          {customer.phone && (
                            <span className="flex items-center gap-1.5">
                              <Phone className="size-4" aria-hidden="true" />
                              {customer.phone}
                            </span>
                          )}
                        </div>
                        {customer.notes && (
                          <p className="mt-4 whitespace-pre-wrap text-sm leading-6">
                            {customer.notes}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setEditor({ kind: "customer", id: customer.id })
                        }
                      >
                        <Pencil aria-hidden="true" /> 编辑档案
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div
                role="tablist"
                aria-label="客户卡片内容"
                className="flex flex-wrap gap-2"
              >
                {(
                  [
                    ["inquiries", "询盘", inquiries.length, Inbox],
                    ["quotes", "报价", quotes.length, FileText],
                    ["samples", "样品", samples.length, Package],
                    ["tasks", "跟进", tasks.length, CalendarClock],
                  ] as const
                ).map(([value, label, count, Icon]) => (
                  <Button
                    key={value}
                    role="tab"
                    aria-selected={section === value}
                    variant={section === value ? "default" : "outline"}
                    onClick={() => {
                      setSection(value);
                      setEditor(null);
                    }}
                  >
                    <Icon aria-hidden="true" /> {label}{" "}
                    <Badge
                      variant={section === value ? "secondary" : "outline"}
                    >
                      {count}
                    </Badge>
                  </Button>
                ))}
              </div>

              <Card className="shadow-none">
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">
                    {section === "inquiries"
                      ? "询盘历史"
                      : section === "quotes"
                        ? "报价历史"
                        : section === "samples"
                          ? "样品进度"
                          : "跟进任务"}
                  </CardTitle>
                  <Button
                    size="sm"
                    onClick={() => setEditor({ kind: section })}
                  >
                    <Plus aria-hidden="true" />
                    {section === "inquiries"
                      ? "归档询盘"
                      : section === "quotes"
                        ? "记录报价"
                        : section === "samples"
                          ? "创建样品"
                          : "安排跟进"}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {editor?.kind === "inquiries" && (
                    <div className="rounded-lg border p-4">
                      <InquiryForm
                        key={`inquiry-${editor.id ?? "new"}`}
                        customer={customer}
                        inquiry={allCustomerInquiries.find(
                          (item) => item.id === editor.id,
                        )}
                        onSaved={saved}
                        onCancel={() => setEditor(null)}
                      />
                    </div>
                  )}
                  {editor?.kind === "quotes" && (
                    <div className="rounded-lg border p-4">
                      <QuoteForm
                        key={`quote-${editor.id ?? "new"}`}
                        customer={customer}
                        inquiries={allCustomerInquiries}
                        quote={quotes.find((item) => item.id === editor.id)}
                        onSaved={saved}
                        onCancel={() => setEditor(null)}
                      />
                    </div>
                  )}
                  {editor?.kind === "samples" && (
                    <div className="rounded-lg border p-4">
                      <SampleForm
                        key={`sample-${editor.id ?? "new"}`}
                        customer={customer}
                        inquiries={allCustomerInquiries}
                        sample={samples.find((item) => item.id === editor.id)}
                        onSaved={saved}
                        onCancel={() => setEditor(null)}
                      />
                    </div>
                  )}
                  {editor?.kind === "tasks" && (
                    <div className="rounded-lg border p-4">
                      <TaskForm
                        key={`task-${editor.id ?? "new"}`}
                        customer={customer}
                        inquiries={allCustomerInquiries}
                        task={tasks.find((item) => item.id === editor.id)}
                        onSaved={saved}
                        onCancel={() => setEditor(null)}
                      />
                    </div>
                  )}

                  {section === "inquiries" &&
                    (inquiries.length ? (
                      inquiries.map((inquiry) => (
                        <article
                          key={inquiry.id}
                          className="rounded-lg border p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge>{stageLabel(inquiry.stage)}</Badge>
                                <span className="text-sm font-medium">
                                  {inquiry.receivedOn}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {inquiry.source} · {inquiry.country}
                                </span>
                              </div>
                              <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
                                {inquiry.content}
                              </p>
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {inquiry.products.map((product) => (
                                  <Badge key={product} variant="outline">
                                    {product}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`编辑 ${inquiry.receivedOn} 询盘`}
                              onClick={() =>
                                setEditor({ kind: "inquiries", id: inquiry.id })
                              }
                            >
                              <Pencil aria-hidden="true" />
                            </Button>
                          </div>
                        </article>
                      ))
                    ) : (
                      <Empty>
                        还没有询盘。归档第一条询盘后，可按来源、国家、产品和阶段筛选。
                      </Empty>
                    ))}

                  {section === "quotes" &&
                    (quotes.length ? (
                      quotes.map((quote) => (
                        <article
                          key={quote.id}
                          className="rounded-lg border p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium">
                                  {quote.currency} {quote.amount}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {quote.quotedOn}
                                  {quote.inquiryId ? " · 已关联询盘" : ""}
                                </span>
                              </div>
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                                {quote.content}
                              </p>
                              {quote.notes && (
                                <p className="mt-2 text-xs text-muted-foreground">
                                  {quote.notes}
                                </p>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`编辑 ${quote.quotedOn} 报价`}
                              onClick={() =>
                                setEditor({ kind: "quotes", id: quote.id })
                              }
                            >
                              <Pencil aria-hidden="true" />
                            </Button>
                          </div>
                        </article>
                      ))
                    ) : (
                      <Empty>
                        {allCustomerInquiries.length
                          ? "还没有报价记录。可记录多次报价并选择关联询盘。"
                          : "还没有报价记录；当前也没有可关联的询盘。"}
                      </Empty>
                    ))}

                  {section === "samples" &&
                    (samples.length ? (
                      samples.map((sample) => (
                        <details
                          key={sample.id}
                          className="rounded-lg border p-4"
                        >
                          <summary className="cursor-pointer list-none focus-visible:ring-2 focus-visible:ring-ring">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium">
                                    {sample.product}
                                  </span>
                                  <Badge variant="secondary">
                                    {sampleStageLabel(sample.currentStage)}
                                  </Badge>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {sample.requestedOn} · {sample.quantity} 件
                                  {sample.inquiryId ? " · 已关联询盘" : ""}
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={(event) => {
                                  event.preventDefault();
                                  setEditor({ kind: "samples", id: sample.id });
                                }}
                              >
                                <Pencil aria-hidden="true" /> 编辑
                              </Button>
                            </div>
                          </summary>
                          <div className="mt-4 border-t pt-4">
                            <ol className="space-y-2">
                              {sample.progress.map((progress) => (
                                <li
                                  key={progress.id}
                                  className="flex gap-3 text-sm"
                                >
                                  <span className="w-24 shrink-0 text-muted-foreground">
                                    {progress.occurredOn}
                                  </span>
                                  <span>
                                    <strong className="font-medium">
                                      {sampleStageLabel(progress.stage)}
                                    </strong>
                                    {progress.notes && ` · ${progress.notes}`}
                                  </span>
                                </li>
                              ))}
                            </ol>
                            <SampleProgressForm
                              key={`${sample.id}-${sample.currentStage}`}
                              sample={sample}
                              onSaved={refresh}
                            />
                            <ShipmentForm sample={sample} onSaved={refresh} />
                          </div>
                        </details>
                      ))
                    ) : (
                      <Empty>
                        还没有样品记录。创建后，阶段变化会作为历史事件保留。
                      </Empty>
                    ))}

                  {section === "tasks" && (
                    <>
                      {actionError && (
                        <div
                          role="alert"
                          className="flex items-center gap-3 rounded-md bg-destructive/10 p-3 text-sm"
                        >
                          <p className="min-w-0 flex-1">{actionError}</p>
                          {refreshFailed && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={refreshing}
                              onClick={() => void retryRefresh()}
                            >
                              {refreshing ? "刷新中…" : "重试刷新"}
                            </Button>
                          )}
                        </div>
                      )}
                      {tasks.length ? (
                        tasks.map((task) => (
                          <article
                            key={task.id}
                            className="flex items-start gap-3 rounded-lg border p-4"
                          >
                            <Button
                              variant={task.completed ? "secondary" : "outline"}
                              size="icon"
                              aria-label={
                                task.completed ? "标记为未完成" : "标记为已完成"
                              }
                              disabled={
                                busyTask === task.id ||
                                refreshing ||
                                refreshFailed ||
                                committedTask?.id === task.id
                              }
                              onClick={() =>
                                toggleTask(task.id, !task.completed)
                              }
                            >
                              <CheckCircle2 aria-hidden="true" />
                            </Button>
                            <div className="min-w-0 flex-1">
                              <p
                                className={
                                  task.completed
                                    ? "text-sm text-muted-foreground line-through"
                                    : "text-sm"
                                }
                              >
                                {task.content}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {task.dueAt.replace("T", " ")}
                                {task.inquiryId ? " · 已关联询盘" : ""}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`编辑跟进任务 ${task.content}`}
                              onClick={() =>
                                setEditor({ kind: "tasks", id: task.id })
                              }
                            >
                              <Pencil aria-hidden="true" />
                            </Button>
                          </article>
                        ))
                      ) : (
                        <Empty>
                          还没有跟进任务。安排后会同步到业务管理的今日待办与日历。
                        </Empty>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
