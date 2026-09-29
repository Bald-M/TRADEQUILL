import { invoke } from "@tauri-apps/api/core";

export const followUpStages = [
  ["new", "新询盘"],
  ["contacted", "已联系"],
  ["quoted", "已报价"],
  ["sampling", "样品中"],
  ["won", "已成交"],
  ["paused", "暂缓"],
] as const;

export const sampleStages = [
  ["requested", "已申请"],
  ["preparing", "准备中"],
  ["sent", "已寄出"],
  ["received", "已签收"],
  ["completed", "已完成"],
  ["cancelled", "已取消"],
] as const;

export const currencies = ["USD", "CNY", "EUR", "GBP", "JPY"] as const;

export interface CustomerRecord {
  id: number;
  name: string;
  company: string;
  email: string;
  phone: string;
  country: string;
  source: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface InquiryRecord {
  id: number;
  customerId: number;
  receivedOn: string;
  content: string;
  source: string;
  country: string;
  products: string[];
  stage: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteRecord {
  id: number;
  customerId: number;
  inquiryId: number | null;
  quotedOn: string;
  content: string;
  amount: string;
  currency: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface SampleProgressRecord {
  id: number;
  sampleId: number;
  stage: string;
  occurredOn: string;
  notes: string;
  createdAt: string;
}

export interface SampleRecord {
  id: number;
  customerId: number;
  inquiryId: number | null;
  product: string;
  quantity: number;
  requestedOn: string;
  notes: string;
  carrier: string;
  trackingNumber: string;
  currentStage: string;
  createdAt: string;
  updatedAt: string;
  progress: SampleProgressRecord[];
}

export interface FollowUpTaskRecord {
  id: number;
  customerId: number;
  inquiryId: number | null;
  dueAt: string;
  content: string;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessSnapshot {
  customers: CustomerRecord[];
  inquiries: InquiryRecord[];
  quotes: QuoteRecord[];
  samples: SampleRecord[];
  tasks: FollowUpTaskRecord[];
}

export interface CustomerInput {
  id: number | null;
  name: string;
  company: string;
  email: string;
  phone: string;
  country: string;
  source: string;
  notes: string;
}

export interface InquiryInput {
  id: number | null;
  customerId: number;
  receivedOn: string;
  content: string;
  source: string;
  country: string;
  products: string[];
  stage: string;
}

export interface QuoteInput {
  id: number | null;
  customerId: number;
  inquiryId: number | null;
  quotedOn: string;
  content: string;
  amount: string;
  currency: string;
  notes: string;
}

export interface SampleInput {
  id: number | null;
  customerId: number;
  inquiryId: number | null;
  product: string;
  quantity: number;
  requestedOn: string;
  notes: string;
}

export interface SampleProgressInput {
  sampleId: number;
  stage: string;
  occurredOn: string;
  notes: string;
}

export interface SampleShipmentInput {
  sampleId: number;
  carrier: string;
  trackingNumber: string;
}

export interface FollowUpTaskInput {
  id: number | null;
  customerId: number;
  inquiryId: number | null;
  dueAt: string;
  content: string;
}

export interface ReminderSummary {
  localDate: string;
  dueToday: number;
  overdue: number;
}

export interface InquiryFilters {
  source: string;
  country: string;
  product: string;
  stage: string;
}

export type TaskBucket = "overdue" | "today" | "upcoming" | "completed";

export function getBusinessSnapshot(): Promise<BusinessSnapshot> {
  return invoke<BusinessSnapshot>("business_snapshot");
}

export function saveCustomer(input: CustomerInput): Promise<void> {
  return invoke("save_customer", { input });
}

export function saveInquiry(input: InquiryInput): Promise<void> {
  return invoke("save_inquiry", { input });
}

export function saveQuote(input: QuoteInput): Promise<void> {
  return invoke("save_quote", { input });
}

export function saveSample(input: SampleInput): Promise<void> {
  return invoke("save_sample", { input });
}

export function appendSampleProgress(
  input: SampleProgressInput,
): Promise<void> {
  return invoke("append_sample_progress", { input });
}

export function updateSampleShipment(
  input: SampleShipmentInput,
): Promise<void> {
  return invoke("update_sample_shipment", { input });
}

export function saveFollowUpTask(input: FollowUpTaskInput): Promise<void> {
  return invoke("save_follow_up_task", { input });
}

export function setFollowUpTaskCompleted(
  taskId: number,
  completed: boolean,
): Promise<void> {
  return invoke("set_follow_up_task_completed", { taskId, completed });
}

export function getDueReminder(
  localDate: string,
  localDateTime: string,
): Promise<ReminderSummary | null> {
  return invoke("due_reminder", { localDate, localDateTime });
}

export function markReminderSent(localDate: string): Promise<void> {
  return invoke("mark_reminder_sent", { localDate });
}

export function splitProducts(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(/[,，、\n]/)
    .map((item) => item.trim())
    .filter((item) => {
      const key = item.toLocaleLowerCase();
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function filterInquiries(
  inquiries: InquiryRecord[],
  filters: InquiryFilters,
): InquiryRecord[] {
  return inquiries.filter(
    (inquiry) =>
      (!filters.source || inquiry.source === filters.source) &&
      (!filters.country || inquiry.country === filters.country) &&
      (!filters.product || inquiry.products.includes(filters.product)) &&
      (!filters.stage || inquiry.stage === filters.stage),
  );
}

export function taskBucket(
  task: FollowUpTaskRecord,
  today: string,
): TaskBucket {
  if (task.completed) return "completed";
  const taskDate = task.dueAt.slice(0, 10);
  if (taskDate < today) return "overdue";
  if (taskDate === today) return "today";
  return "upcoming";
}

export function localDateValue(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function localDateTimeValue(date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${localDateValue(date)}T${hours}:${minutes}`;
}

export function stageLabel(stage: string): string {
  return followUpStages.find(([value]) => value === stage)?.[1] ?? stage;
}

export function sampleStageLabel(stage: string): string {
  return sampleStages.find(([value]) => value === stage)?.[1] ?? stage;
}
