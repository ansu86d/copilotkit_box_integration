export interface BoxCommandResult<T = unknown> {
  ok: boolean;
  command: string[];
  data?: T;
  stderr?: string;
  stdout?: string;
  mock: boolean;
}

export interface BoxFolderItem {
  id: string;
  name: string;
  type: "file" | "folder" | string;
  modified_at?: string;
}
