import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { FileText, Pencil, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fieldClass } from "@/components/business/BusinessForms";
import { ErrorNotice, Field, KnowledgeForm } from "./CatalogForms";
import {
  catalogError,
  deleteKnowledge,
  getKnowledgeDocument,
  searchKnowledge,
  setKnowledgeArchived,
  splitTags,
  type KnowledgeDetail,
  type KnowledgeSnippet,
  type KnowledgeSummary,
  type ProductRecord,
} from "@/lib/catalog";

function DocumentBadges({
  document,
  product,
}: {
  document: KnowledgeSummary;
  product?: ProductRecord;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge variant="outline">
        {document.kind === "faq"
          ? "FAQ"
          : document.kind === "file"
            ? document.format.toUpperCase()
            : "文本"}
      </Badge>
      <Badge variant="secondary">
        {document.status === "confirmed" ? "已确认" : "草稿"}
      </Badge>
      <Badge variant="outline">
        {document.visibility === "public" ? "对外可用" : "仅内部"}
      </Badge>
      {document.archived && <Badge variant="secondary">资料已归档</Badge>}
      {product?.archived && <Badge variant="secondary">产品已归档</Badge>}
      {document.conflictNote && <Badge variant="outline">有待核实说明</Badge>}
    </div>
  );
}

export function KnowledgeWorkspace({
  documents,
  products,
  refresh,
  onEditing,
}: {
  documents: KnowledgeSummary[];
  products: ProductRecord[];
  refresh: () => Promise<void>;
  onEditing: (editing: boolean) => void;
}) {
  const prefix = useId();
  const [query, setQuery] = useState("");
  const [tags, setTags] = useState("");
  const [allProducts, setAllProducts] = useState(true);
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  const [includeGeneral, setIncludeGeneral] = useState(true);
  const [confirmedOnly, setConfirmedOnly] = useState(false);
  const [publicOnly, setPublicOnly] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [results, setResults] = useState<KnowledgeSnippet[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<KnowledgeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [selectedPage, setSelectedPage] = useState<number | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [editor, setEditor] = useState<"create" | "edit" | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [actionError, setActionError] = useState("");
  const searchGeneration = useRef(0);
  const detailGeneration = useRef(0);
  const pageRef = useRef<HTMLHeadingElement>(null);
  const productIds = allProducts
    ? products.map((product) => product.id)
    : selectedProducts;

  useEffect(() => {
    onEditing(editor !== null);
    return () => onEditing(false);
  }, [editor, onEditing]);
  useEffect(
    () => () => {
      searchGeneration.current += 1;
      detailGeneration.current += 1;
    },
    [],
  );
  useEffect(() => {
    if (detail && selectedPage !== null) {
      pageRef.current?.focus();
      pageRef.current?.scrollIntoView?.({ block: "nearest" });
    }
  }, [detail, selectedPage]);

  const clearSearch = useCallback(() => {
    searchGeneration.current += 1;
    setResults(null);
    setSearching(false);
    setSearchError("");
  }, []);
  // A saved revision or deletion invalidates snippets from the previous snapshot.
  useEffect(() => {
    clearSearch();
  }, [documents, clearSearch]);

  async function openDocument(
    documentId: number,
    page: number | null = null,
    version: number | null = null,
  ) {
    const generation = ++detailGeneration.current;
    setSelectedId(documentId);
    setDetail(null);
    setSelectedPage(page);
    setSelectedVersion(version);
    setDetailError("");
    setActionError("");
    setDeleteConfirm(false);
    setDetailLoading(true);
    try {
      const next = await getKnowledgeDocument(documentId);
      if (generation === detailGeneration.current) setDetail(next);
    } catch (failure) {
      if (generation === detailGeneration.current)
        setDetailError(catalogError(failure));
    } finally {
      if (generation === detailGeneration.current) setDetailLoading(false);
    }
  }

  async function search(event: FormEvent) {
    event.preventDefault();
    if (searching) return;
    if (!query.trim()) {
      setSearchError("请输入关键词。已选择的资料范围会保留。");
      return;
    }
    if (productIds.length === 0 && !includeGeneral) {
      setSearchError("请选择至少一个产品，或包含通用资料。");
      return;
    }
    const generation = ++searchGeneration.current;
    setSearching(true);
    setSearchError("");
    setResults(null);
    try {
      const next = await searchKnowledge({
        query,
        allProducts,
        productIds: allProducts ? [] : selectedProducts,
        documentIds: [],
        includeGeneral,
        tags: splitTags(tags),
        confirmedOnly,
        publicOnly,
      });
      if (generation === searchGeneration.current) setResults(next);
    } catch (failure) {
      if (generation === searchGeneration.current)
        setSearchError(catalogError(failure));
    } finally {
      if (generation === searchGeneration.current) setSearching(false);
    }
  }

  async function saved() {
    await refresh();
    if (selectedId !== null && editor === "edit")
      await openDocument(selectedId);
    setEditor(null);
  }

  async function updateDocument(action: "archive" | "delete") {
    if (!detail || busy || committed) return;
    const document = detail.document;
    setBusy(true);
    setActionError("");
    try {
      if (action === "delete") await deleteKnowledge(document.id);
      else await setKnowledgeArchived(document.id, !document.archived);
    } catch (failure) {
      setActionError(catalogError(failure));
      setBusy(false);
      return;
    }
    setCommitted(true);
    setDeleteConfirm(false);
    clearSearch();
    try {
      await refresh();
      await openDocument(document.id);
      setCommitted(false);
    } catch (failure) {
      setActionError(
        `资料${action === "delete" ? "删除" : "归档状态"}已保存，但界面刷新失败：${catalogError(failure)}。请重试刷新。`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function retryRefresh() {
    setBusy(true);
    try {
      await refresh();
      if (selectedId !== null) await openDocument(selectedId);
      setCommitted(false);
      setActionError("");
    } catch (failure) {
      setActionError(
        `界面刷新失败：${catalogError(failure)}。资料变更已保存。`,
      );
    } finally {
      setBusy(false);
    }
  }

  const selectedProduct = products.find(
    (product) => product.id === detail?.document.productId,
  );
  const visibleDocuments = documents.filter(
    (document) => showArchived || !document.archived,
  );
  const selectedDocument = detail?.document;

  return (
    <div className="space-y-4">
      <Card className="shadow-none">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>本地知识检索</CardTitle>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                资料留在本机。搜索现行版本的文本片段；草稿和内部资料可由下方条件筛选，已归档资料不会命中。
              </p>
            </div>
            <Button
              disabled={editor !== null || busy || committed}
              onClick={() => {
                setEditor("create");
                setActionError("");
              }}
            >
              <Plus aria-hidden="true" />
              新建资料
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={search} className="space-y-4">
            <ErrorNotice message={searchError} />
            <fieldset
              disabled={editor !== null || busy || committed}
              className="space-y-4"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id={`${prefix}-query`} label="关键词">
                  <input
                    id={`${prefix}-query`}
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      clearSearch();
                    }}
                    className={fieldClass}
                  />
                </Field>
                <Field
                  id={`${prefix}-tags`}
                  label="标签筛选"
                  hint="用逗号或顿号分隔。"
                >
                  <input
                    id={`${prefix}-tags`}
                    value={tags}
                    onChange={(event) => {
                      setTags(event.target.value);
                      clearSearch();
                    }}
                    className={fieldClass}
                  />
                </Field>
              </div>
              <fieldset className="space-y-2 rounded-md border p-3">
                <legend className="px-1 text-sm font-medium">
                  检索产品范围
                </legend>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={allProducts}
                      onChange={(event) => {
                        setAllProducts(event.target.checked);
                        clearSearch();
                      }}
                      className="accent-primary"
                    />
                    全部产品（{products.length}）
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={includeGeneral}
                      onChange={(event) => {
                        setIncludeGeneral(event.target.checked);
                        clearSearch();
                      }}
                      className="accent-primary"
                    />
                    包含通用资料
                  </label>
                </div>
                {!allProducts && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {products.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        尚无产品，可先检索通用资料。
                      </p>
                    ) : (
                      products.map((product) => (
                        <label
                          key={product.id}
                          className="flex items-start gap-2 break-words text-sm"
                        >
                          <input
                            type="checkbox"
                            className="mt-1 accent-primary"
                            checked={selectedProducts.includes(product.id)}
                            onChange={(event) => {
                              setSelectedProducts((current) =>
                                event.target.checked
                                  ? [...current, product.id]
                                  : current.filter((id) => id !== product.id),
                              );
                              clearSearch();
                            }}
                          />
                          {product.sku} · {product.name}
                          {product.archived ? "（产品已归档）" : ""}
                        </label>
                      ))
                    )}
                  </div>
                )}
              </fieldset>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="accent-primary"
                    checked={confirmedOnly}
                    onChange={(event) => {
                      setConfirmedOnly(event.target.checked);
                      clearSearch();
                    }}
                  />
                  只检索已确认资料
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="accent-primary"
                    checked={publicOnly}
                    onChange={(event) => {
                      setPublicOnly(event.target.checked);
                      clearSearch();
                    }}
                  />
                  只检索对外可用资料
                </label>
                <Button type="submit" disabled={searching}>
                  <Search aria-hidden="true" />
                  {searching ? "搜索中…" : "搜索本地资料"}
                </Button>
              </div>
            </fieldset>
          </form>
          {searching && (
            <p role="status" className="mt-4 text-sm">
              正在检索选定范围…
            </p>
          )}
          {results !== null && (
            <section aria-label="检索结果" className="mt-4 space-y-3">
              <p role="status" className="text-sm text-muted-foreground">
                {results.length
                  ? `找到 ${results.length} 个匹配片段`
                  : "选定范围没有匹配片段。可调整关键词、标签或产品范围。"}
              </p>
              {results.map((snippet, index) => (
                <button
                  type="button"
                  key={`${snippet.documentId}-${snippet.page}-${index}`}
                  disabled={editor !== null || busy || committed}
                  onClick={() => {
                    void openDocument(
                      snippet.documentId,
                      snippet.page,
                      snippet.version,
                    );
                  }}
                  className="w-full space-y-2 rounded-md border p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="block break-words text-sm font-medium">
                    {snippet.title} · v{snippet.version} · 第 {snippet.page} 页
                    {snippet.productArchived ? "（产品已归档）" : ""}
                  </span>
                  <span className="block whitespace-pre-wrap break-words text-sm leading-6">
                    {snippet.text}
                  </span>
                  <span className="block break-words text-xs text-muted-foreground">
                    来源：{snippet.source} ·{" "}
                    {snippet.status === "confirmed" ? "已确认" : "草稿"} ·{" "}
                    {snippet.visibility === "public" ? "对外可用" : "仅内部"}
                  </span>
                  {snippet.conflictNote && (
                    <span className="block text-sm">
                      待核实：{snippet.conflictNote}
                    </span>
                  )}
                </button>
              ))}
            </section>
          )}
        </CardContent>
      </Card>

      <ErrorNotice message={actionError} />
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
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(220px,1fr)_minmax(0,2fr)]">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>资料库 · {visibleDocuments.length}</CardTitle>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(event) => setShowArchived(event.target.checked)}
                className="accent-primary"
              />
              显示已归档资料
            </label>
          </CardHeader>
          <CardContent className="space-y-2">
            {visibleDocuments.length === 0 ? (
              <p className="rounded-md border border-dashed p-5 text-sm text-muted-foreground">
                {documents.length === 0
                  ? "资料库为空。可创建文本、FAQ 或导入文件，离线也能使用。"
                  : "当前没有未归档资料，可显示已归档资料。"}
              </p>
            ) : (
              visibleDocuments.map((document) => (
                <button
                  key={document.id}
                  type="button"
                  aria-pressed={selectedId === document.id}
                  disabled={editor !== null || busy || committed}
                  onClick={() => {
                    void openDocument(document.id);
                  }}
                  className={`w-full space-y-2 rounded-md border p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 ${selectedId === document.id ? "border-ring bg-accent" : ""}`}
                >
                  <span className="block break-words text-sm font-medium">
                    {document.title}
                  </span>
                  <span className="block break-words text-xs text-muted-foreground">
                    {products.find(
                      (product) => product.id === document.productId,
                    )?.name ?? "通用资料"}{" "}
                    · v{document.version}
                  </span>
                  <DocumentBadges
                    document={document}
                    product={products.find(
                      (product) => product.id === document.productId,
                    )}
                  />
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 shadow-none">
          <CardHeader>
            <CardTitle>
              {editor === "create"
                ? "新建知识资料"
                : editor === "edit"
                  ? "更正知识资料"
                  : "资料详情"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editor ? (
              <KnowledgeForm
                key={editor === "edit" ? detail?.document.id : "create"}
                detail={editor === "edit" && detail ? detail : undefined}
                products={products}
                onSaved={saved}
                onCancel={() => setEditor(null)}
              />
            ) : (
              <div className="space-y-4">
                <ErrorNotice message={detailError} />
                {detailError && selectedId !== null && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      void openDocument(
                        selectedId,
                        selectedPage,
                        selectedVersion,
                      );
                    }}
                  >
                    重试读取资料
                  </Button>
                )}
                {detailLoading ? (
                  <p role="status" className="text-sm text-muted-foreground">
                    正在读取资料…
                  </p>
                ) : selectedDocument ? (
                  selectedDocument.deleted ? (
                    <p
                      role="status"
                      className="rounded-md border border-dashed p-5 text-sm text-muted-foreground"
                    >
                      来源已删除。原文、文件副本和派生索引已移除，历史引用失效；产品档案和历史交易保留。
                    </p>
                  ) : (
                    <>
                      <h3 className="break-words text-lg font-medium">
                        {selectedDocument.title}
                      </h3>
                      <DocumentBadges
                        document={selectedDocument}
                        product={selectedProduct}
                      />
                      <dl className="space-y-2 text-sm">
                        <div>
                          <dt className="text-xs text-muted-foreground">
                            关联产品
                          </dt>
                          <dd className="break-words">
                            {selectedProduct
                              ? `${selectedProduct.sku} · ${selectedProduct.name}`
                              : "通用资料"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">
                            来源
                          </dt>
                          <dd className="break-words">
                            {selectedDocument.source}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">
                            标签
                          </dt>
                          <dd className="break-words">
                            {selectedDocument.tags.join("、") || "未设置"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">
                            现行版本及更新时间
                          </dt>
                          <dd>
                            v{selectedDocument.version} ·{" "}
                            {selectedDocument.updatedAt}
                          </dd>
                        </div>
                      </dl>
                      {selectedDocument.archived && (
                        <p className="rounded-md bg-muted p-3 text-sm">
                          资料已归档，当前检索和默认问答不能使用。历史引用标记为已归档。
                        </p>
                      )}
                      {selectedVersion !== null &&
                        selectedVersion !== selectedDocument.version && (
                          <p className="rounded-md bg-muted p-3 text-sm">
                            刚才的引用为旧版本 v{selectedVersion}，当前显示 v
                            {selectedDocument.version}。旧片段不能作为现行事实。
                          </p>
                        )}
                      {selectedDocument.conflictNote && (
                        <p className="rounded-md border p-3 text-sm leading-6">
                          资料冲突或待核实说明：{selectedDocument.conflictNote}
                          。这是人工记录，请核对来源；不会自动覆盖产品字段。
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          disabled={busy || committed}
                          onClick={() => setEditor("edit")}
                        >
                          <Pencil aria-hidden="true" />
                          更正或更新版本
                        </Button>
                        <Button
                          variant="outline"
                          disabled={busy || committed}
                          onClick={() => {
                            void updateDocument("archive");
                          }}
                        >
                          {busy
                            ? "保存中…"
                            : selectedDocument.archived
                              ? "恢复资料"
                              : "归档资料"}
                        </Button>
                        <Button
                          variant="destructive"
                          disabled={busy || committed}
                          onClick={() => setDeleteConfirm(true)}
                        >
                          删除资料
                        </Button>
                      </div>
                      {deleteConfirm && (
                        <div className="space-y-3 rounded-md border border-destructive/30 p-3">
                          <p className="text-sm leading-6">
                            永久删除“{selectedDocument.title}
                            ”的全部应用内版本、文件副本和提取文本。历史引用将失效，产品档案和交易记录不受影响。
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              disabled={busy}
                              onClick={() => setDeleteConfirm(false)}
                            >
                              取消删除
                            </Button>
                            <Button
                              variant="destructive"
                              disabled={busy}
                              onClick={() => {
                                void updateDocument("delete");
                              }}
                            >
                              确认永久删除
                            </Button>
                          </div>
                        </div>
                      )}
                      {detail?.pages.map((page) => (
                        <section
                          key={page.page}
                          className={`space-y-2 rounded-md border p-4 ${selectedPage === page.page ? "border-ring" : ""}`}
                        >
                          <h4
                            ref={
                              selectedPage === page.page ? pageRef : undefined
                            }
                            tabIndex={-1}
                            className="flex items-center gap-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <FileText aria-hidden="true" className="size-4" />第{" "}
                            {page.page} 页 · v{selectedDocument.version}
                          </h4>
                          <p className="whitespace-pre-wrap break-words text-sm leading-6">
                            {page.text}
                          </p>
                        </section>
                      ))}
                      <section className="space-y-2 border-t pt-4">
                        <h4 className="text-sm font-medium">版本记录</h4>
                        <p className="text-xs leading-5 text-muted-foreground">
                          旧版本用于追溯，不默认代表有效事实。相同标题或最新文件不能证明权威性。
                        </p>
                        <ul className="space-y-2 text-xs text-muted-foreground">
                          {detail?.history.map((version) => (
                            <li key={version.version} className="break-words">
                              v{version.version} ·{" "}
                              {version.current
                                ? "现行版本"
                                : "旧版本，引用需核对"}{" "}
                              · {version.createdAt}
                              {version.fileName ? ` · ${version.fileName}` : ""}
                            </li>
                          ))}
                        </ul>
                      </section>
                    </>
                  )
                ) : (
                  !detailError && (
                    <p className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                      选择条目或搜索片段查看原文、页码和来源版本。
                    </p>
                  )
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
