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
}: {
  snapshot: CommerceSnapshot;
  business: BusinessSnapshot;
  refresh: () => Promise<void>;
  route: CommerceRoute;
  navigate: (route: CommerceRoute) => void;
}) {
  const shared = { snapshot, business, refresh, navigate, route };
  return (
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
            variant={route.kind === kind ? "default" : "outline"}
            aria-current={route.kind === kind ? "page" : undefined}
            onClick={() => navigate({ kind })}
          >
            {label}
          </Button>
        ))}
      </nav>
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
  );
}
