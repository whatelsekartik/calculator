import { DNode, nodesToText } from "../display";

/** test helper: flatten display nodes to text */
export function formatRealHarness(nodes: DNode[]): string {
  return nodesToText(nodes);
}
