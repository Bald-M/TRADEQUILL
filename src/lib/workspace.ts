import { invoke, isTauri } from "@tauri-apps/api/core";

export interface WorkspaceStatus {
  databasePath: string;
  attachmentsPath: string;
  schemaVersion: number;
}

export async function getWorkspaceStatus(): Promise<WorkspaceStatus> {
  if (!isTauri()) {
    throw new Error(
      "当前为界面预览。请使用 pnpm desktop:dev 启动桌面应用以连接本地数据库。",
    );
  }
  return invoke<WorkspaceStatus>("workspace_status");
}
