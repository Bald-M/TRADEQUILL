import { useEffect, useState } from "react";
import { CommerceEditing } from "./Shared";
import { Button } from "@/components/ui/button";
import type { BusinessSnapshot } from "@/lib/business";
import type { CommerceRoute, CommerceSnapshot } from "@/lib/commerce";
import { Products, Suppliers } from "./Catalog";
import { Quotes } from "./Quotes";
import { Orders } from "./Orders";
import { Reports } from "./Reports";

export function CommerceWorkspace({
  snapshot,
  business,
  refresh,
  route,
  navigate,
  onEditing,
}: {
  snapshot: CommerceSnapshot;
  business: BusinessSnapshot;
  refresh: () => Promise<void>;
  route: CommerceRoute;
  navigate: (route: CommerceRoute) => void;
  onEditing?: (editing: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    onEditing?.(editing);
  }, [editing, onEditing]);
  useEffect(() => () => onEditing?.(false), [onEditing]);
  const shared = { snapshot, business, refresh, navigate, route };
  return (
    <CommerceEditing.Provider value={setEditing}>
      <div className="space-y-5">
        <nav aria-label="交易业务模块" className="flex flex-wrap gap-2">
          {(
            [
              ["products", "产品档案"],
              ["suppliers", "供应商"],
              ["quotes", "报价单"],
              ["orders", "订单与成本"],
              ["reports", "经营统计"],
            ] as const
          ).map(([kind, label]) => (
            <Button
              key={kind}
              disabled={editing}
              variant={route.kind === kind ? "default" : "outline"}
              aria-current={route.kind === kind ? "page" : undefined}
              onClick={() => navigate({ kind })}
            >
              {label}
            </Button>
          ))}
        </nav>
        {editing && (
          <p role="status" className="text-sm text-muted-foreground">
            请先保存或取消当前交易编辑，再切换模块。
          </p>
        )}
        <div key={JSON.stringify(route)}>
          {route.kind === "products" ? (
            <Products {...shared} selectedId={route.id} />
          ) : route.kind === "suppliers" ? (
            <Suppliers {...shared} selectedId={route.id} />
          ) : route.kind === "quotes" ? (
            <Quotes {...shared} />
          ) : route.kind === "orders" ? (
            <Orders {...shared} />
          ) : (
            <Reports
              business={business}
              refreshVersion={snapshot.orders}
              navigate={navigate}
            />
          )}
        </div>
      </div>
    </CommerceEditing.Provider>
  );
}
