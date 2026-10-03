import { invoke } from "@tauri-apps/api/core";

export interface ProductParameter {
  name: string;
  value: string;
}

export interface ProductInput {
  id: number | null;
  sku: string;
  name: string;
  unit: string;
  parameters: ProductParameter[];
  moq: string | null;
  leadTimeDays: number | null;
  leadTimeNote: string;
}

export interface ProductRecord extends Omit<ProductInput, "id"> {
  id: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export type KnowledgeKind = "text" | "faq" | "file";
export type KnowledgeStatus = "draft" | "confirmed";
export type KnowledgeVisibility = "public" | "internal";
export type KnowledgeFormat = "text" | "txt" | "md" | "pdf";

export interface KnowledgeInput {
  id: number | null;
  expectedVersion: number | null;
  title: string;
  productId: number | null;
  tags: string[];
  source: string;
  kind: KnowledgeKind;
  status: KnowledgeStatus;
  visibility: KnowledgeVisibility;
  conflictNote: string;
  text: string;
  previewToken: string | null;
}

export interface KnowledgeSummary {
  id: number;
  title: string;
  productId: number | null;
  tags: string[];
  source: string;
  kind: KnowledgeKind;
  status: KnowledgeStatus;
  visibility: KnowledgeVisibility;
  conflictNote: string;
  archived: boolean;
  deleted: boolean;
  version: number;
  format: KnowledgeFormat;
  fileName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgePage {
  page: number;
  text: string;
}

export interface KnowledgeDetail {
  document: KnowledgeSummary;
  pages: KnowledgePage[];
  history: Array<{
    version: number;
    format: KnowledgeFormat;
    fileName: string | null;
    createdAt: string;
    current: boolean;
  }>;
}

export interface KnowledgePreview {
  token: string;
  fileName: string;
  format: "txt" | "md" | "pdf";
  pages: KnowledgePage[];
  digest: string;
  expiresAt: string;
}

export interface CatalogSnapshot {
  products: ProductRecord[];
  documents: KnowledgeSummary[];
}

export interface KnowledgeSearchInput {
  query: string;
  productIds: number[];
  documentIds: number[];
  includeGeneral: boolean;
  tags: string[];
  confirmedOnly: boolean;
  publicOnly: boolean;
}

export interface KnowledgeSnippet {
  documentId: number;
  version: number;
  page: number;
  title: string;
  text: string;
  productId: number | null;
  productArchived: boolean;
  source: string;
  status: KnowledgeStatus;
  visibility: KnowledgeVisibility;
  format: KnowledgeFormat;
  conflictNote: string;
}

export function getCatalogSnapshot(): Promise<CatalogSnapshot> {
  return invoke("list_catalog");
}

export function saveProduct(input: ProductInput): Promise<void> {
  return invoke("save_product", { input });
}

export function setProductArchived(
  productId: number,
  archived: boolean,
): Promise<void> {
  return invoke("set_product_archived", { productId, archived });
}

export function previewKnowledgeImport(
  fileName: string,
  bytes: number[],
): Promise<KnowledgePreview> {
  return invoke("preview_knowledge_import", { input: { fileName, bytes } });
}

export function saveKnowledge(input: KnowledgeInput): Promise<void> {
  return invoke("save_knowledge", { input });
}

export function getKnowledgeDocument(
  documentId: number,
): Promise<KnowledgeDetail> {
  return invoke("get_knowledge_document", { documentId });
}

export function setKnowledgeArchived(
  documentId: number,
  archived: boolean,
): Promise<void> {
  return invoke("set_knowledge_archived", { documentId, archived });
}

export function deleteKnowledge(documentId: number): Promise<void> {
  return invoke("delete_knowledge", { documentId });
}

export function searchKnowledge(
  input: KnowledgeSearchInput,
): Promise<KnowledgeSnippet[]> {
  return invoke("search_knowledge", { input });
}

export function splitTags(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(/[,，、\n]/)
    .map((tag) => tag.trim())
    .filter((tag) => {
      const key = tag.toLocaleLowerCase();
      if (!tag || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function productCopyText(product: ProductRecord): string {
  return [
    `${product.name}（${product.sku}）${product.archived ? " [已归档]" : ""}`,
    ...product.parameters.map(({ name, value }) => `${name}：${value}`),
    `计量单位：${product.unit}`,
    `MOQ：${product.moq === null ? "未知" : `${product.moq} ${product.unit}`}`,
    `交期：${product.leadTimeDays === null ? "未知" : `${product.leadTimeDays} 天`}`,
    `交期含义：${product.leadTimeNote || "未说明"}`,
    `档案更新时间：${product.updatedAt}`,
  ].join("\n");
}

export function catalogError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
