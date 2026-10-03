// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteKnowledge,
  getKnowledgeDocument,
  searchKnowledge,
  type KnowledgeDetail,
  type KnowledgeSnippet,
  type ProductRecord,
} from "@/lib/catalog";
import { KnowledgeWorkspace } from "./KnowledgeWorkspace";

vi.mock("@/lib/catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/catalog")>();
  return {
    ...actual,
    searchKnowledge: vi.fn(),
    getKnowledgeDocument: vi.fn(),
    setKnowledgeArchived: vi.fn(),
    deleteKnowledge: vi.fn(),
  };
});

const products: ProductRecord[] = [1, 2].map((id) => ({
  id,
  sku: `SKU-${id}`,
  name: `型号 ${id}`,
  unit: "件",
  parameters: [],
  moq: null,
  leadTimeDays: null,
  leadTimeNote: "",
  archived: id === 2,
  createdAt: "2026-10-01",
  updatedAt: "2026-10-01",
}));
const detail: KnowledgeDetail = {
  document: {
    id: 3,
    title: "型号一手册",
    productId: 1,
    tags: ["容量"],
    source: "厂家手册",
    kind: "file",
    status: "confirmed",
    visibility: "public",
    conflictNote: "",
    archived: false,
    deleted: false,
    version: 2,
    format: "pdf",
    fileName: "manual.pdf",
    createdAt: "2026-10-01",
    updatedAt: "2026-10-02",
  },
  pages: [
    { page: 1, text: "介绍" },
    { page: 2, text: "容量为 250 ml。" },
  ],
  history: [
    {
      version: 2,
      format: "pdf",
      fileName: "manual.pdf",
      createdAt: "2026-10-02",
      current: true,
    },
    {
      version: 1,
      format: "pdf",
      fileName: "old.pdf",
      createdAt: "2026-10-01",
      current: false,
    },
  ],
};
const documents = [detail.document];
const snippet: KnowledgeSnippet = {
  documentId: 3,
  title: "型号一手册",
  productId: 1,
  productArchived: false,
  version: 2,
  page: 2,
  text: "容量为 250 ml。",
  source: "厂家手册",
  status: "confirmed",
  visibility: "public",
  format: "pdf",
  conflictNote: "",
};
const mockedSearch = vi.mocked(searchKnowledge);
const mockedDetail = vi.mocked(getKnowledgeDocument);
const mockedDelete = vi.mocked(deleteKnowledge);

afterEach(cleanup);
beforeEach(() => {
  mockedSearch.mockReset();
  mockedDetail.mockReset();
  mockedDelete.mockReset();
});

function workspace(refresh = vi.fn().mockResolvedValue(undefined)) {
  return (
    <KnowledgeWorkspace
      documents={documents}
      products={products}
      refresh={refresh}
      onEditing={vi.fn()}
    />
  );
}

describe("local knowledge workspace", () => {
  it("sends only explicitly selected product and general-material scopes", async () => {
    const user = userEvent.setup();
    mockedSearch.mockResolvedValue([]);
    render(workspace());
    await user.click(screen.getByRole("checkbox", { name: "全部产品（2）" }));
    await user.click(screen.getByRole("checkbox", { name: "SKU-1 · 型号 1" }));
    await user.click(screen.getByRole("checkbox", { name: "包含通用资料" }));
    await user.click(
      screen.getByRole("checkbox", { name: "只检索已确认资料" }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: "只检索对外可用资料" }),
    );
    await user.type(screen.getByLabelText("关键词"), "容量");
    await user.type(screen.getByLabelText("标签筛选"), "规格、规格");
    await user.click(screen.getByRole("button", { name: "搜索本地资料" }));
    expect(mockedSearch).toHaveBeenCalledWith({
      query: "容量",
      productIds: [1],
      documentIds: [],
      includeGeneral: false,
      tags: ["规格"],
      confirmedOnly: true,
      publicOnly: true,
    });
    expect(await screen.findByText(/选定范围没有匹配片段/)).toBeInTheDocument();
  });

  it("keeps generic-only scope explicit and never expands it to all products", async () => {
    const user = userEvent.setup();
    mockedSearch.mockResolvedValue([]);
    render(workspace());
    await user.click(screen.getByRole("checkbox", { name: "全部产品（2）" }));
    await user.type(screen.getByLabelText("关键词"), "保养");
    await user.click(screen.getByRole("button", { name: "搜索本地资料" }));
    expect(mockedSearch).toHaveBeenCalledWith(
      expect.objectContaining({ productIds: [], includeGeneral: true }),
    );
  });

  it("drops a late response when the user changes the search scope", async () => {
    const user = userEvent.setup();
    let resolveSearch!: (results: KnowledgeSnippet[]) => void;
    mockedSearch.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSearch = resolve;
        }),
    );
    render(workspace());
    await user.type(screen.getByLabelText("关键词"), "容量");
    await user.click(screen.getByRole("button", { name: "搜索本地资料" }));
    await user.click(screen.getByRole("checkbox", { name: "包含通用资料" }));
    resolveSearch([snippet]);
    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "检索结果" }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.queryByText("容量为 250 ml。")).not.toBeInTheDocument();
  });

  it("opens the cited PDF page and marks an old version visibly", async () => {
    const user = userEvent.setup();
    mockedSearch.mockResolvedValue([{ ...snippet, version: 1 }]);
    mockedDetail.mockResolvedValue(detail);
    render(workspace());
    await user.type(screen.getByLabelText("关键词"), "容量");
    await user.click(screen.getByRole("button", { name: "搜索本地资料" }));
    await user.click(
      await screen.findByRole("button", { name: /型号一手册 · v1 · 第 2 页/ }),
    );
    expect(mockedDetail).toHaveBeenCalledWith(3);
    expect(
      await screen.findByText(/刚才的引用为旧版本 v1/),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "第 2 页 · v2" })).toHaveFocus();
    expect(screen.getByText(/v1 · 旧版本，引用需核对/)).toBeInTheDocument();
  });

  it("requires explicit deletion, removes search snippets, and shows the tombstone", async () => {
    const user = userEvent.setup();
    mockedSearch.mockResolvedValue([snippet]);
    mockedDetail.mockResolvedValueOnce(detail).mockResolvedValueOnce({
      document: { ...detail.document, title: "已删除资料", deleted: true },
      pages: [],
      history: [],
    });
    mockedDelete.mockResolvedValue();
    const refresh = vi.fn().mockResolvedValue(undefined);
    render(workspace(refresh));
    await user.type(screen.getByLabelText("关键词"), "容量");
    await user.click(screen.getByRole("button", { name: "搜索本地资料" }));
    await user.click(
      await screen.findByRole("button", { name: /型号一手册 · v2 · 第 2 页/ }),
    );
    await user.click(await screen.findByRole("button", { name: "删除资料" }));
    expect(mockedDelete).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "确认永久删除" }));
    expect(mockedDelete).toHaveBeenCalledOnce();
    expect(mockedDelete).toHaveBeenCalledWith(3);
    expect(refresh).toHaveBeenCalledOnce();
    expect(await screen.findByText(/来源已删除。原文/)).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "检索结果" }),
    ).not.toBeInTheDocument();
  });
});
