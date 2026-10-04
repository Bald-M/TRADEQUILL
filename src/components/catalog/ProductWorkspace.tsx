import { useEffect, useId, useState } from "react";
import { Copy, Package, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fieldClass } from "@/components/business/BusinessForms";
import { ErrorNotice, ProductForm } from "./CatalogForms";
import {
  catalogError,
  productCopyText,
  setProductArchived,
  type ProductRecord,
} from "@/lib/catalog";

export function ProductWorkspace({
  products,
  refresh,
  onEditing,
}: {
  products: ProductRecord[];
  refresh: () => Promise<void>;
  onEditing: (editing: boolean) => void;
}) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editor, setEditor] = useState<"create" | "edit" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [committed, setCommitted] = useState(false);
  const normalized = query.trim().toLocaleLowerCase();
  const matches = products.filter(
    (product) =>
      (showArchived || !product.archived) &&
      (!normalized ||
        `${product.sku}\n${product.name}`
          .toLocaleLowerCase()
          .includes(normalized)),
  );
  const product = products.find((item) => item.id === selectedId);

  useEffect(() => {
    onEditing(editor !== null);
    return () => onEditing(false);
  }, [editor, onEditing]);

  async function saved() {
    await refresh();
    setEditor(null);
  }
  async function archive() {
    if (!product || busy || committed) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await setProductArchived(product.id, !product.archived);
    } catch (failure) {
      setError(catalogError(failure));
      setBusy(false);
      return;
    }
    setCommitted(true);
    try {
      await refresh();
      setCommitted(false);
    } catch (failure) {
      setError(
        `归档状态已保存，但界面刷新失败：${catalogError(failure)}。请重试刷新。`,
      );
    } finally {
      setBusy(false);
    }
  }
  async function retryRefresh() {
    setBusy(true);
    try {
      await refresh();
      setCommitted(false);
      setError("");
    } catch (failure) {
      setError(`界面刷新失败：${catalogError(failure)}。归档状态已保存。`);
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    if (!product) return;
    setError("");
    setNotice("");
    try {
      await navigator.clipboard.writeText(productCopyText(product));
      setNotice("产品资料已复制。");
    } catch (failure) {
      setError(`复制失败：${catalogError(failure)}。可在详情中选中文本复制。`);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="shadow-none">
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <label htmlFor={searchId} className="text-sm font-medium">
                搜索产品编号或名称
              </label>
              <p className="mt-1 text-xs text-muted-foreground">
                已有询盘和样品文本保留原样，不自动映射产品档案。
              </p>
            </div>
            <Button
              disabled={editor !== null || busy || committed}
              onClick={() => {
                setEditor("create");
                setError("");
                setNotice("");
              }}
            >
              <Plus aria-hidden="true" />
              新建产品
            </Button>
          </div>
          <input
            id={searchId}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={fieldClass}
            disabled={editor !== null}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => setShowArchived(event.target.checked)}
              disabled={editor !== null}
              className="accent-primary"
            />
            包含已归档产品
          </label>
        </CardContent>
      </Card>
      <ErrorNotice message={error} />
      {committed && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            void retryRefresh();
          }}
        >
          {busy ? "刷新中…" : "重试刷新"}
        </Button>
      )}
      {notice && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(220px,1fr)_minmax(0,2fr)]">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>产品档案 · {matches.length}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {matches.length === 0 ? (
              <div className="space-y-3 rounded-md border border-dashed p-5 text-sm text-muted-foreground">
                <p>
                  {products.length === 0
                    ? "尚无产品档案。新建产品后，可关联知识资料。"
                    : "当前筛选没有产品。"}
                </p>
                {(query ||
                  (!showArchived &&
                    products.some((item) => item.archived))) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setQuery("");
                      setShowArchived(true);
                    }}
                  >
                    清除筛选
                  </Button>
                )}
              </div>
            ) : (
              matches.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={editor !== null || busy || committed}
                  aria-pressed={selectedId === item.id}
                  onClick={() => {
                    setSelectedId(item.id);
                    setNotice("");
                    setError("");
                  }}
                  className={`w-full rounded-md border p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 ${selectedId === item.id ? "border-ring bg-accent" : ""}`}
                >
                  <span className="block break-words text-xs text-muted-foreground">
                    {item.sku}
                  </span>
                  <span className="mt-1 block break-words text-sm font-medium">
                    {item.name}
                  </span>
                  {item.archived && (
                    <Badge variant="secondary" className="mt-2">
                      已归档
                    </Badge>
                  )}
                </button>
              ))
            )}
          </CardContent>
        </Card>
        <Card className="min-w-0 shadow-none">
          <CardHeader>
            <CardTitle>
              {editor === "create"
                ? "新建产品"
                : editor === "edit"
                  ? "编辑产品"
                  : "产品详情"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editor ? (
              <ProductForm
                key={editor === "edit" ? product?.id : "create"}
                product={editor === "edit" ? product : undefined}
                onSaved={saved}
                onCancel={() => setEditor(null)}
              />
            ) : product ? (
              <div className="space-y-5">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Package aria-hidden="true" className="size-5" />
                    <h3 className="break-words text-lg font-medium">
                      {product.name}
                    </h3>
                    {product.archived && (
                      <Badge variant="secondary">已归档</Badge>
                    )}
                  </div>
                  <p className="break-words text-sm text-muted-foreground">
                    编号：{product.sku}
                  </p>
                </div>
                {product.archived && (
                  <p className="rounded-md bg-muted p-3 text-sm">
                    此产品已归档。保留已有资料和历史交易，不作为新业务的默认选项。
                  </p>
                )}
                <dl className="space-y-3 text-sm">
                  {product.parameters.map(({ name, value }, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-[minmax(80px,1fr)_2fr] gap-3"
                    >
                      <dt className="break-words text-muted-foreground">
                        {name}
                      </dt>
                      <dd className="whitespace-pre-wrap break-words">
                        {value}
                      </dd>
                    </div>
                  ))}
                  <div className="grid grid-cols-[minmax(80px,1fr)_2fr] gap-3">
                    <dt className="text-muted-foreground">计量单位</dt>
                    <dd className="break-words">{product.unit}</dd>
                  </div>
                  <div className="grid grid-cols-[minmax(80px,1fr)_2fr] gap-3">
                    <dt className="text-muted-foreground">MOQ</dt>
                    <dd>
                      {product.moq === null
                        ? "未知"
                        : `${product.moq} ${product.unit}`}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[minmax(80px,1fr)_2fr] gap-3">
                    <dt className="text-muted-foreground">交期</dt>
                    <dd>
                      {product.leadTimeDays === null
                        ? "未知"
                        : `${product.leadTimeDays}–${product.leadTimeMaxDays ?? product.leadTimeDays} 天`}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[minmax(80px,1fr)_2fr] gap-3">
                    <dt className="text-muted-foreground">交期含义</dt>
                    <dd className="break-words">
                      {product.leadTimeNote || "未说明"}
                    </dd>
                  </div>
                </dl>
                <p className="text-xs text-muted-foreground">
                  档案更新时间：{product.updatedAt}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      void copy();
                    }}
                  >
                    <Copy aria-hidden="true" />
                    复制资料
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy || committed}
                    onClick={() => setEditor("edit")}
                  >
                    <Pencil aria-hidden="true" />
                    编辑产品
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy || committed}
                    onClick={() => {
                      void archive();
                    }}
                  >
                    {busy
                      ? "保存中…"
                      : product.archived
                        ? "恢复产品"
                        : "归档产品"}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                选择产品查看参数、MOQ 与交期，或新建档案。
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
