import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, Package, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  catalogError,
  getCatalogSnapshot,
  type CatalogSnapshot,
} from "@/lib/catalog";
import { ErrorNotice } from "./CatalogForms";
import { ProductWorkspace } from "./ProductWorkspace";
import { KnowledgeWorkspace } from "./KnowledgeWorkspace";

export function CatalogWorkspace({
  onEditing,
}: {
  onEditing?: (editing: boolean) => void;
} = {}) {
  const [section, setSection] = useState<"products" | "knowledge">("products");
  const [snapshot, setSnapshot] = useState<CatalogSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const generation = useRef(0);

  useEffect(() => {
    onEditing?.(editing);
  }, [editing, onEditing]);
  useEffect(() => () => onEditing?.(false), [onEditing]);

  const refresh = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const next = await getCatalogSnapshot();
      if (request === generation.current) setSnapshot(next);
    } catch (failure) {
      if (request === generation.current)
        setError(
          `本地产品与资料读取失败：${catalogError(failure)}。已填写内容会保留，请重试刷新。`,
        );
      throw failure;
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh().catch(() => {});
    return () => {
      generation.current += 1;
    };
  }, [refresh]);

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button
          variant="outline"
          disabled={loading || editing}
          onClick={() => {
            void refresh().catch(() => {});
          }}
        >
          <RefreshCw aria-hidden="true" />
          {loading ? "读取中…" : "刷新资料"}
        </Button>
      </div>
      <ErrorNotice message={error} />
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="产品与知识库页面"
      >
        <Button
          variant={section === "products" ? "default" : "outline"}
          aria-pressed={section === "products"}
          disabled={editing}
          onClick={() => setSection("products")}
        >
          <Package aria-hidden="true" />
          产品档案
        </Button>
        <Button
          variant={section === "knowledge" ? "default" : "outline"}
          aria-pressed={section === "knowledge"}
          disabled={editing}
          onClick={() => setSection("knowledge")}
        >
          <BookOpen aria-hidden="true" />
          知识资料
        </Button>
      </div>
      {editing && (
        <p className="text-xs text-muted-foreground">
          请先保存或取消当前编辑，再切换页面。
        </p>
      )}
      {loading && !snapshot ? (
        <Card className="shadow-none">
          <CardContent className="p-6">
            <p role="status" className="text-sm text-muted-foreground">
              正在读取本地产品与资料…
            </p>
          </CardContent>
        </Card>
      ) : snapshot ? (
        section === "products" ? (
          <ProductWorkspace
            products={snapshot.products}
            refresh={refresh}
            onEditing={setEditing}
          />
        ) : (
          <KnowledgeWorkspace
            products={snapshot.products}
            documents={snapshot.documents}
            refresh={refresh}
            onEditing={setEditing}
          />
        )
      ) : (
        <p className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
          暂时无法读取资料。请使用刷新资料重试；本地记录不会因读取失败而删除。
        </p>
      )}
    </div>
  );
}
