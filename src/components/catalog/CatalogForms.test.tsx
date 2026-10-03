// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  previewKnowledgeImport,
  saveKnowledge,
  saveProduct,
  type KnowledgeDetail,
} from "@/lib/catalog";
import { KnowledgeForm, ProductForm } from "./CatalogForms";

vi.mock("@/lib/catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/catalog")>();
  return {
    ...actual,
    saveProduct: vi.fn(),
    saveKnowledge: vi.fn(),
    previewKnowledgeImport: vi.fn(),
  };
});

const productSave = vi.mocked(saveProduct);
const knowledgeSave = vi.mocked(saveKnowledge);
const previewImport = vi.mocked(previewKnowledgeImport);

const detail: KnowledgeDetail = {
  document: {
    id: 4,
    title: "保养指南",
    productId: null,
    tags: ["保养"],
    source: "手册 v2",
    kind: "text",
    status: "confirmed",
    visibility: "public",
    conflictNote: "旧手册水温不同",
    archived: false,
    deleted: false,
    version: 2,
    format: "text",
    fileName: "",
    createdAt: "2026-10-01",
    updatedAt: "2026-10-02",
  },
  pages: [{ page: 1, text: "请用温水清洁。" }],
  history: [
    {
      version: 2,
      format: "text",
      fileName: "",
      createdAt: "2026-10-02",
      current: true,
    },
  ],
};

afterEach(cleanup);
beforeEach(() => {
  productSave.mockReset();
  knowledgeSave.mockReset();
  previewImport.mockReset();
});

async function fillProduct(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("产品编号 *"), "SKU-A");
  await user.type(screen.getByLabelText("产品名称 *"), "测试产品");
  await user.type(screen.getByLabelText("计量单位 *"), "千克");
}

describe("ProductForm", () => {
  it("preserves input and rejects zero MOQ or ambiguous lead time", async () => {
    const user = userEvent.setup();
    render(<ProductForm onSaved={vi.fn()} onCancel={vi.fn()} />);
    await fillProduct(user);
    await user.type(screen.getByLabelText("MOQ"), "0");
    await user.type(screen.getByLabelText("交期（天）"), "7");
    await user.click(screen.getByRole("button", { name: "创建产品" }));
    expect(productSave).not.toHaveBeenCalled();
    expect(screen.getByLabelText("MOQ")).toHaveValue("0");
    expect(screen.getByLabelText("交期含义")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByRole("alert")).toHaveFocus();
  });

  it("saves named parameters and preserves unknown quantities as null", async () => {
    const user = userEvent.setup();
    productSave.mockResolvedValue();
    const onSaved = vi.fn().mockResolvedValue(undefined);
    render(<ProductForm onSaved={onSaved} onCancel={vi.fn()} />);
    await fillProduct(user);
    await user.click(screen.getByRole("button", { name: "添加参数" }));
    await user.type(screen.getByLabelText("参数 1 名称"), "材质");
    await user.type(screen.getByLabelText("参数 1 值"), "不锈钢");
    await user.click(screen.getByRole("button", { name: "创建产品" }));
    expect(productSave).toHaveBeenCalledWith(
      expect.objectContaining({
        moq: null,
        leadTimeDays: null,
        parameters: [{ name: "材质", value: "不锈钢" }],
      }),
    );
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it("keeps a failed SKU save editable for correction and retry", async () => {
    const user = userEvent.setup();
    productSave
      .mockRejectedValueOnce(new Error("产品编号已存在"))
      .mockResolvedValueOnce();
    render(
      <ProductForm
        onSaved={vi.fn().mockResolvedValue(undefined)}
        onCancel={vi.fn()}
      />,
    );
    await fillProduct(user);
    await user.click(screen.getByRole("button", { name: "创建产品" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "产品编号已存在",
    );
    const sku = screen.getByLabelText("产品编号 *");
    expect(sku).toHaveValue("SKU-A");
    await user.clear(sku);
    await user.type(sku, "SKU-B");
    await user.click(screen.getByRole("button", { name: "创建产品" }));
    expect(productSave).toHaveBeenCalledTimes(2);
    expect(productSave).toHaveBeenLastCalledWith(
      expect.objectContaining({ sku: "SKU-B" }),
    );
  });

  it("does not repeat a committed save after refresh failure", async () => {
    const user = userEvent.setup();
    productSave.mockResolvedValue();
    render(
      <ProductForm
        onSaved={vi.fn().mockRejectedValue(new Error("刷新失败"))}
        onCancel={vi.fn()}
      />,
    );
    await fillProduct(user);
    await user.click(screen.getByRole("button", { name: "创建产品" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("数据已保存");
    expect(screen.getByRole("button", { name: "已保存" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "已保存" }));
    expect(productSave).toHaveBeenCalledOnce();
  });
});

describe("KnowledgeForm", () => {
  it("ignores a late extraction preview after the user selects another file", async () => {
    const user = userEvent.setup();
    let resolveOld!: (
      preview: Awaited<ReturnType<typeof previewKnowledgeImport>>,
    ) => void;
    previewImport
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve;
          }),
      )
      .mockResolvedValueOnce({
        token: "new-token",
        fileName: "new.txt",
        format: "txt",
        pages: [{ page: 1, text: "新资料" }],
        digest: "new",
        expiresAt: "2026-10-03T10:15:00Z",
      });
    render(
      <KnowledgeForm products={[]} onSaved={vi.fn()} onCancel={vi.fn()} />,
    );
    await user.selectOptions(screen.getByLabelText("资料类型"), "file");
    const oldFile = new File(["old"], "old.txt", { type: "text/plain" });
    const newFile = new File(["new"], "new.txt", { type: "text/plain" });
    for (const file of [oldFile, newFile])
      Object.defineProperty(file, "arrayBuffer", {
        value: async () => new ArrayBuffer(3),
      });
    await user.upload(screen.getByLabelText("选择文件 *"), oldFile);
    expect(screen.getByRole("button", { name: "取消" })).toBeEnabled();
    await user.upload(screen.getByLabelText("选择文件 *"), newFile);
    expect(await screen.findByText("新资料")).toBeInTheDocument();
    await act(async () => {
      resolveOld({
        token: "old-token",
        fileName: "old.txt",
        format: "txt",
        pages: [{ page: 1, text: "旧资料" }],
        digest: "old",
        expiresAt: "2026-10-03T10:15:00Z",
      });
    });
    expect(screen.queryByText("旧资料")).not.toBeInTheDocument();
    expect(screen.getByLabelText("资料标题 *")).toHaveValue("new.txt");
  });

  it("requires extraction preview confirmation before saving a file", async () => {
    const user = userEvent.setup();
    previewImport.mockResolvedValue({
      token: "preview-1",
      fileName: "manual.md",
      format: "md",
      pages: [{ page: 1, text: "容量 250 ml" }],
      digest: "hash",
      expiresAt: "2026-10-03T10:15:00Z",
    });
    knowledgeSave.mockResolvedValue();
    render(
      <KnowledgeForm
        products={[]}
        onSaved={vi.fn().mockResolvedValue(undefined)}
        onCancel={vi.fn()}
      />,
    );
    await user.selectOptions(screen.getByLabelText("资料类型"), "file");
    const file = new File(["容量 250 ml"], "manual.md", {
      type: "text/markdown",
    });
    Object.defineProperty(file, "arrayBuffer", {
      value: async () => new TextEncoder().encode("容量 250 ml").buffer,
    });
    await user.upload(screen.getByLabelText("选择文件 *"), file);
    expect(await screen.findByText("容量 250 ml")).toBeInTheDocument();
    expect(knowledgeSave).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "保存资料" }));
    expect(knowledgeSave).not.toHaveBeenCalled();
    expect(screen.getByLabelText("选择文件 *")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await user.click(
      screen.getByRole("checkbox", {
        name: "我已核对提取内容，确认将其保存到本地资料库",
      }),
    );
    await user.click(screen.getByRole("button", { name: "保存资料" }));
    expect(knowledgeSave).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "manual.md",
        source: "manual.md",
        previewToken: "preview-1",
        text: "",
        status: "draft",
        visibility: "internal",
      }),
    );
  });

  it("preserves manual edits when expected-version checking fails", async () => {
    const user = userEvent.setup();
    knowledgeSave.mockRejectedValue(new Error("资料版本冲突，请重新读取"));
    render(
      <KnowledgeForm
        detail={detail}
        products={[]}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const text = screen.getByLabelText("资料正文 *");
    await user.type(text, " 避免沸水。");
    await user.click(screen.getByRole("button", { name: "保存新版本" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("资料版本冲突");
    expect(text).toHaveValue("请用温水清洁。 避免沸水。");
    expect(knowledgeSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 4,
        expectedVersion: 2,
        conflictNote: "旧手册水温不同",
      }),
    );
    expect(screen.getByRole("button", { name: "保存新版本" })).toBeEnabled();
  });

  it("reports duplicate-file extraction without replacing existing content", async () => {
    const user = userEvent.setup();
    previewImport.mockRejectedValue(new Error("相同文件已在资料库中"));
    const fileDetail: KnowledgeDetail = {
      ...detail,
      document: {
        ...detail.document,
        kind: "file",
        format: "pdf",
        fileName: "existing.pdf",
      },
    };
    render(
      <KnowledgeForm
        detail={fileDetail}
        products={[]}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const file = new File(["duplicate"], "manual.pdf", {
      type: "application/pdf",
    });
    Object.defineProperty(file, "arrayBuffer", {
      value: async () => new ArrayBuffer(9),
    });
    await user.upload(screen.getByLabelText("替换文件（可选）"), file);
    expect(await screen.findByRole("alert")).toHaveTextContent("相同文件");
    expect(screen.getByText(/保留现有文件：existing.pdf/)).toBeInTheDocument();
    expect(screen.getByLabelText("资料标题 *")).toHaveValue("保养指南");
    expect(knowledgeSave).not.toHaveBeenCalled();
  });
});
