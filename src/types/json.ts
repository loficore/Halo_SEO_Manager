export type JSONPatchOp =
  | { op: "replace"; path: string; value: unknown }
  | { op: "add"; path: string; value: unknown }
  | { op: "remove"; path: string }
  | { op: "copy"; path: string; from: string }
  | { op: "move"; path: string; from: string }
  | { op: "test"; path: string; value: unknown };

export type JSONPatchDocument = JSONPatchOp[];