import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Pencil,
} from "lucide-react";
import { DateTimeField } from "@/components/ui/date-time-field";
import { isDateValue } from "@/lib/date-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskForm } from "@/components/business/BusinessForms";
import {
  localDateValue,
  setFollowUpTaskCompleted,
  taskBucket,
  type BusinessSnapshot,
  type FollowUpTaskRecord,
  type TaskBucket,
} from "@/lib/business";

const bucketMeta: Record<TaskBucket, { label: string; icon: typeof Clock3 }> = {
  overdue: { label: "逾期未完成", icon: AlertTriangle },
  today: { label: "今日待办", icon: Clock3 },
  upcoming: { label: "后续安排", icon: CalendarDays },
  completed: { label: "已完成", icon: CheckCircle2 },
};

export function FollowUpWorkspace({
  snapshot,
  refresh,
  reminderMessage,
  openCustomers,
}: {
  snapshot: BusinessSnapshot;
  refresh: () => Promise<void>;
  reminderMessage: string;
  openCustomers: () => void;
}) {
  const [today, setToday] = useState(localDateValue);
  const todayRef = useRef(today);
  const [calendarDate, setCalendarDate] = useState(today);
  const [editingTask, setEditingTask] = useState<FollowUpTaskRecord | null>(
    null,
  );
  const [busyTask, setBusyTask] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [committedTask, setCommittedTask] = useState<{
    id: number;
    completed: boolean;
  } | null>(null);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const groups = useMemo(
    () =>
      snapshot.tasks.reduce<Record<TaskBucket, FollowUpTaskRecord[]>>(
        (result, task) => {
          result[taskBucket(task, today)].push(task);
          return result;
        },
        { overdue: [], today: [], upcoming: [], completed: [] },
      ),
    [snapshot.tasks, today],
  );
  const calendarTasks = snapshot.tasks.filter(
    (task) =>
      isDateValue(calendarDate) && task.dueAt.slice(0, 10) === calendarDate,
  );
  const editingCustomer = editingTask
    ? snapshot.customers.find(
        (customer) => customer.id === editingTask.customerId,
      )
    : undefined;
  const editingInquiries = editingTask
    ? snapshot.inquiries.filter(
        (inquiry) => inquiry.customerId === editingTask.customerId,
      )
    : [];

  useEffect(() => {
    const syncLocalDate = () => {
      const next = localDateValue();
      const previous = todayRef.current;
      if (next === previous) return;
      todayRef.current = next;
      setToday(next);
      setCalendarDate((selected) => (selected === previous ? next : selected));
    };
    const interval = window.setInterval(syncLocalDate, 60 * 1000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") syncLocalDate();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", syncLocalDate);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", syncLocalDate);
    };
  }, []);

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
      setError("");
    }
  }, [committedTask, snapshot.tasks]);

  async function toggle(task: FollowUpTaskRecord) {
    setBusyTask(task.id);
    setError("");
    setRefreshFailed(false);
    try {
      await setFollowUpTaskCompleted(task.id, !task.completed);
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : String(actionError),
      );
      setBusyTask(null);
      return;
    }
    setCommittedTask({ id: task.id, completed: !task.completed });
    try {
      await refresh();
    } catch (actionError) {
      setRefreshFailed(true);
      setError(
        `任务状态已更新，但界面刷新失败：${actionError instanceof Error ? actionError.message : String(actionError)}。`,
      );
    } finally {
      setBusyTask(null);
    }
  }

  async function retryRefresh() {
    setRefreshing(true);
    try {
      await refresh();
    } catch (actionError) {
      setError(
        `任务状态已更新，但界面刷新失败：${actionError instanceof Error ? actionError.message : String(actionError)}。`,
      );
    } finally {
      setRefreshing(false);
    }
  }

  function customerName(id: number) {
    return (
      snapshot.customers.find((customer) => customer.id === id)?.name ??
      "未知客户"
    );
  }

  function TaskRow({ task }: { task: FollowUpTaskRecord }) {
    return (
      <article className="flex items-start gap-3 rounded-lg border p-3">
        <Button
          variant={task.completed ? "secondary" : "outline"}
          size="icon"
          aria-label={task.completed ? "标记为未完成" : "标记为已完成"}
          disabled={
            busyTask === task.id ||
            refreshing ||
            refreshFailed ||
            committedTask?.id === task.id
          }
          onClick={() => toggle(task)}
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
            {task.dueAt.replace("T", " ")} · {customerName(task.customerId)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`编辑 ${task.content}`}
          onClick={() => setEditingTask(task)}
        >
          <Pencil aria-hidden="true" />
        </Button>
      </article>
    );
  }

  return (
    <div className="space-y-4">
      {reminderMessage && (
        <div
          role="status"
          className="rounded-lg border bg-muted/50 p-4 text-sm leading-6"
        >
          {reminderMessage}
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-lg bg-destructive/10 p-4 text-sm"
        >
          <p className="min-w-0 flex-1">{error}</p>
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

      <div className="grid gap-4 md:grid-cols-4">
        {(Object.keys(bucketMeta) as TaskBucket[]).map((bucket) => {
          const { label, icon: Icon } = bucketMeta[bucket];
          return (
            <Card key={bucket} className="shadow-none">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 text-2xl font-semibold">
                    {groups[bucket].length}
                  </p>
                </div>
                <Icon
                  className="size-5 text-muted-foreground"
                  aria-hidden="true"
                />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {snapshot.customers.length === 0 && (
        <Card className="shadow-none">
          <CardContent className="p-8 text-center">
            <p className="text-sm text-muted-foreground">
              先建立客户档案，再为客户或询盘安排跟进。
            </p>
            <Button className="mt-4" onClick={openCustomers}>
              前往客户管理
            </Button>
          </CardContent>
        </Card>
      )}

      {editingTask && editingCustomer && (
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base">
              改期或编辑跟进 · {editingCustomer.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TaskForm
              key={`task-${editingTask.id}`}
              customer={editingCustomer}
              inquiries={editingInquiries}
              task={editingTask}
              onSaved={async () => {
                await refresh();
                setEditingTask(null);
              }}
              onCancel={() => setEditingTask(null)}
            />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)]">
        <div className="space-y-4">
          {(["overdue", "today", "upcoming", "completed"] as TaskBucket[]).map(
            (bucket) => {
              const { label, icon: Icon } = bucketMeta[bucket];
              return (
                <Card key={bucket} className="shadow-none">
                  <CardHeader className="flex-row items-center justify-between space-y-0 p-4">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Icon className="size-4" aria-hidden="true" />
                      {label}
                    </CardTitle>
                    <Badge variant="outline">{groups[bucket].length}</Badge>
                  </CardHeader>
                  <CardContent className="space-y-2 p-4 pt-0">
                    {groups[bucket].length ? (
                      groups[bucket].map((task) => (
                        <TaskRow key={task.id} task={task} />
                      ))
                    ) : (
                      <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
                        {bucket === "today"
                          ? "今天没有待办。"
                          : bucket === "overdue"
                            ? "没有逾期任务。"
                            : bucket === "upcoming"
                              ? "暂时没有后续安排。"
                              : "还没有已完成任务。"}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            },
          )}
        </div>

        <Card className="h-fit shadow-none">
          <CardHeader>
            <CardTitle className="text-base">按日期查看</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DateTimeField
              label="日历日期"
              value={calendarDate}
              onChange={setCalendarDate}
            />
            <div className="space-y-2">
              {calendarTasks.length ? (
                calendarTasks.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))
              ) : (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  {isDateValue(calendarDate)
                    ? "这一天没有安排。"
                    : "请选择有效日期查看安排。"}
                </p>
              )}
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              每日 09:00
              后，应用在运行或重新打开时会尝试发送一次今日/逾期摘要。完全退出应用后不会在后台运行。
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
