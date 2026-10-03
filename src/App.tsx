import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  Database,
  Feather,
  FolderArchive,
  LayoutDashboard,
  LoaderCircle,
  Moon,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sun,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CustomerWorkspace } from "@/components/business/CustomerWorkspace";
import { FollowUpWorkspace } from "@/components/business/FollowUpWorkspace";
import { CatalogWorkspace } from "@/components/catalog/CatalogWorkspace";
import { useTheme } from "@/hooks/use-theme";
import { useDailyReminder } from "@/hooks/use-daily-reminder";
import {
  getBusinessSnapshot,
  taskBucket,
  localDateValue,
  type BusinessSnapshot,
} from "@/lib/business";
import { getWorkspaceStatus, type WorkspaceStatus } from "@/lib/workspace";
import "./App.css";

const pages = [
  { id: "overview", label: "工作台", icon: LayoutDashboard },
  { id: "customers", label: "客户管理", icon: Users },
  { id: "business", label: "业务管理", icon: BriefcaseBusiness },
  { id: "catalog", label: "产品与知识库", icon: BookOpen },
  { id: "data", label: "数据管理", icon: FolderArchive },
  { id: "settings", label: "设置", icon: Settings2 },
] as const;
type Page = (typeof pages)[number]["id"];
type StorageState =
  | { kind: "loading" }
  | { kind: "ready"; data: WorkspaceStatus }
  | { kind: "error"; message: string };
type BusinessState =
  | { kind: "idle" | "loading" }
  | { kind: "ready"; data: BusinessSnapshot }
  | { kind: "error"; message: string };

function App() {
  const [page, setPage] = useState<Page>("overview");
  const [storage, setStorage] = useState<StorageState>({ kind: "loading" });
  const [business, setBusiness] = useState<BusinessState>({ kind: "idle" });
  const [attempt, setAttempt] = useState(0);
  const { dark, toggleTheme } = useTheme();
  const activePage = pages.find((item) => item.id === page)!;
  const reminderMessage = useDailyReminder(storage.kind === "ready");

  const refreshBusiness = useCallback(async () => {
    try {
      const data = await getBusinessSnapshot();
      setBusiness({ kind: "ready", data });
    } catch (error) {
      setBusiness((current) =>
        current.kind === "ready"
          ? current
          : {
              kind: "error",
              message: error instanceof Error ? error.message : String(error),
            },
      );
      throw error;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    getWorkspaceStatus().then(
      (data) => {
        if (!cancelled) setStorage({ kind: "ready", data });
      },
      (error: unknown) => {
        if (!cancelled)
          setStorage({
            kind: "error",
            message: error instanceof Error ? error.message : String(error),
          });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  useEffect(() => {
    if (storage.kind !== "ready") {
      setBusiness({ kind: "idle" });
      return;
    }
    setBusiness({ kind: "loading" });
    void refreshBusiness().catch(() => undefined);
  }, [refreshBusiness, storage.kind]);

  const retry = () => {
    setStorage({ kind: "loading" });
    setAttempt((value) => value + 1);
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only fixed top-3 left-3 z-50 rounded bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only"
      >
        跳到主要内容
      </a>
      <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col overflow-y-auto border-r bg-sidebar p-4">
        <div className="flex items-center gap-3 px-2 py-5">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Feather className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-lg font-semibold tracking-tight">TradeQuill</p>
            <p className="text-xs text-muted-foreground">个人外贸工作台</p>
          </div>
        </div>
        <p className="mt-7 mb-3 px-3 text-xs font-medium text-muted-foreground">
          工作空间
        </p>
        <nav aria-label="主要导航" className="space-y-1">
          {pages.map(({ id, label, icon: Icon }) => (
            <Button
              key={id}
              variant={page === id ? "secondary" : "ghost"}
              className="h-11 w-full justify-start gap-3"
              aria-current={page === id ? "page" : undefined}
              onClick={() => setPage(id)}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </Button>
          ))}
        </nav>
        <div className="mt-auto space-y-4 px-2">
          <div className="rounded-lg border bg-background p-3">
            <ShieldCheck
              className="mb-2 size-4 text-primary"
              aria-hidden="true"
            />
            <p className="text-sm font-medium">你的数据，留在本机</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              个人工作空间 · 无云端同步
            </p>
          </div>
          <p className="pb-1 text-xs text-muted-foreground">
            TradeQuill <span className="float-right">v0.1.0</span>
          </p>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex h-16 items-center justify-between border-b px-8">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">个人空间</span>
            <ChevronRight
              className="size-3 text-muted-foreground"
              aria-hidden="true"
            />
            <span>{activePage.label}</span>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline">本地模式</Badge>
            <Button
              variant="ghost"
              size="icon"
              aria-label={dark ? "切换到浅色主题" : "切换到深色主题"}
              onClick={toggleTheme}
            >
              {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
            </Button>
          </div>
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto max-w-6xl space-y-7 p-8 focus:outline-none"
        >
          <div>
            <p className="mb-2 text-xs font-medium tracking-widest text-muted-foreground">
              TRADEQUILL / WORKSPACE
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              {page === "overview"
                ? "让每一次业务往来，井然有序。"
                : activePage.label}
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {page === "overview"
                ? "统一整理客户、询盘、报价、样品与下一步跟进。"
                : page === "customers"
                  ? "围绕客户卡片归档每一次业务往来。"
                  : page === "business"
                    ? "集中查看今日、逾期与日历中的跟进任务。"
                    : page === "catalog"
                      ? "维护产品档案、确认资料并在本机检索。无需联网或 AI 服务。"
                      : "一个专注、轻量的本地外贸工作空间。"}
            </p>
          </div>

          {storage.kind !== "ready" && (
            <div
              role="status"
              className="flex items-center gap-3 rounded-lg border bg-muted/40 p-4 text-sm"
            >
              {storage.kind === "loading" ? (
                <>
                  <LoaderCircle
                    className="size-4 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                  正在连接本地工作区…
                </>
              ) : (
                <>
                  <Database className="size-4 shrink-0" aria-hidden="true" />
                  <p className="min-w-0 flex-1 break-words">
                    {storage.message}
                  </p>
                  <Button variant="outline" size="sm" onClick={retry}>
                    <RefreshCw aria-hidden="true" />
                    重试
                  </Button>
                </>
              )}
            </div>
          )}

          {storage.kind === "ready" && business.kind === "error" && (
            <div
              role="alert"
              className="flex items-center gap-3 rounded-lg border bg-destructive/10 p-4 text-sm"
            >
              <Database className="size-4 shrink-0" aria-hidden="true" />
              <p className="min-w-0 flex-1 break-words">
                无法读取业务数据：{business.message}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refreshBusiness().catch(() => undefined)}
              >
                <RefreshCw aria-hidden="true" /> 重试
              </Button>
            </div>
          )}

          {page === "overview" && (
            <>
              <div className="grid gap-4 xl:grid-cols-3">
                {[
                  {
                    title: "客户关系",
                    text:
                      business.kind === "ready"
                        ? `${business.data.customers.length} 位客户 · ${business.data.inquiries.length} 条询盘`
                        : "集中整理客户资料与每一次沟通。",
                    icon: Users,
                    target: "customers" as Page,
                  },
                  {
                    title: "业务进展",
                    text:
                      business.kind === "ready"
                        ? `${business.data.quotes.length} 条报价 · ${business.data.samples.length} 份样品`
                        : "为报价、样品与跟进建立清晰脉络。",
                    icon: BriefcaseBusiness,
                    target: "business" as Page,
                  },
                  {
                    title: "产品与知识库",
                    text: "集中维护产品参数，整理资料与 FAQ 并在本机检索。",
                    icon: BookOpen,
                    target: "catalog" as Page,
                  },
                ].map(({ title, text, icon: Icon, target }) => (
                  <Card key={target} className="shadow-none">
                    <CardHeader>
                      <Icon
                        className="mb-4 size-5 text-primary"
                        aria-hidden="true"
                      />
                      <CardTitle>{title}</CardTitle>
                      <CardDescription className="leading-6">
                        {text}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button
                        variant="ghost"
                        className="-ml-3"
                        onClick={() => setPage(target)}
                      >
                        查看模块
                        <ArrowRight aria-hidden="true" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card className="shadow-none">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>工作空间已起步</CardTitle>
                    <Badge variant="secondary">本地业务工作台</Badge>
                  </div>
                  <CardDescription>
                    客户主线已接入本地 SQLite，数据只经明确的桌面命令访问。
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-4 lg:grid-cols-2">
                    {[
                      "独立桌面窗口",
                      "浅色与深色主题",
                      "本地数据库连接",
                      "客户与业务主线",
                    ].map((label) => (
                      <div
                        key={label}
                        className="flex items-center gap-3 text-sm"
                      >
                        {label === "本地数据库连接" &&
                        storage.kind !== "ready" ? (
                          <Database
                            className="size-4 text-muted-foreground"
                            aria-hidden="true"
                          />
                        ) : (
                          <Check
                            className="size-4 text-primary"
                            aria-hidden="true"
                          />
                        )}
                        <span>
                          {label}
                          {label === "本地数据库连接" &&
                          storage.kind !== "ready"
                            ? "（待连接）"
                            : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                  <Separator />
                  <p className="text-sm leading-6 text-muted-foreground">
                    {business.kind === "ready"
                      ? (() => {
                          const today = localDateValue();
                          const todayCount = business.data.tasks.filter(
                            (task) => taskBucket(task, today) === "today",
                          ).length;
                          const overdueCount = business.data.tasks.filter(
                            (task) => taskBucket(task, today) === "overdue",
                          ).length;
                          return `今日有 ${todayCount} 项待办，另有 ${overdueCount} 项逾期未完成。数据导入导出与完整备份仍在规划中。`;
                        })()
                      : "正在读取客户与业务记录。数据导入导出与完整备份仍在规划中。"}
                  </p>
                </CardContent>
              </Card>
            </>
          )}

          {(page === "customers" || page === "business") &&
            business.kind === "loading" && (
              <Card className="shadow-none">
                <CardContent className="flex min-h-64 items-center justify-center gap-3 text-sm text-muted-foreground">
                  <LoaderCircle
                    className="size-4 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                  正在读取业务记录…
                </CardContent>
              </Card>
            )}

          {page === "customers" && business.kind === "ready" && (
            <CustomerWorkspace
              snapshot={business.data}
              refresh={refreshBusiness}
            />
          )}

          {page === "business" && business.kind === "ready" && (
            <FollowUpWorkspace
              snapshot={business.data}
              refresh={refreshBusiness}
              reminderMessage={reminderMessage}
              openCustomers={() => setPage("customers")}
            />
          )}

          {page === "catalog" && storage.kind === "ready" && (
            <CatalogWorkspace />
          )}

          {page === "data" && (
            <Card className="shadow-none">
              <CardContent className="flex min-h-80 flex-col items-center justify-center p-10 text-center">
                <activePage.icon
                  className="mb-5 size-9 text-muted-foreground"
                  aria-hidden="true"
                />
                <h2 className="text-lg font-medium">数据管理，即将就绪</h2>
                <p className="mt-3 max-w-md text-sm leading-7 text-muted-foreground">
                  导入、导出与完整备份尚未实现。业务表格与包含附件的完整备份将分别提供。
                </p>
                <Badge variant="outline" className="mt-5">
                  规划中
                </Badge>
              </CardContent>
            </Card>
          )}

          {page === "settings" && (
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle>本地工作空间</CardTitle>
                <CardDescription>
                  业务数据保存在系统的应用数据目录中。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm">外观</span>
                  <Button variant="outline" onClick={toggleTheme}>
                    {dark ? "切换浅色" : "切换深色"}
                  </Button>
                </div>
                <Separator />
                {storage.kind === "ready" ? (
                  <dl className="space-y-5 text-sm">
                    <div>
                      <dt className="mb-2 text-muted-foreground">数据库位置</dt>
                      <dd className="select-text break-all rounded bg-muted p-3 font-mono text-xs">
                        {storage.data.databasePath}
                      </dd>
                    </div>
                    <div>
                      <dt className="mb-2 text-muted-foreground">附件目录</dt>
                      <dd className="select-text break-all rounded bg-muted p-3 font-mono text-xs">
                        {storage.data.attachmentsPath}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">数据库版本</dt>
                      <dd>{storage.data.schemaVersion}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    连接成功后将显示本地数据位置。
                  </p>
                )}
                <Separator />
                <p className="text-sm leading-6 text-muted-foreground">
                  本版本不接入在线
                  AI、云端同步或遥测。请妥善保管本机数据；完整备份功能尚在规划中。
                </p>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
