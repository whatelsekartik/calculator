"use client";

/** Renders display-tree nodes as accessible text (no canvas/images). */

import { DNode } from "@/lib/calculator/display";
import { ReactNode } from "react";

function Cursor() {
  return <span className="dn-cursor" aria-hidden="true" />;
}

export function DNodes({ nodes, cursorIdx }: { nodes: DNode[]; cursorIdx?: number }) {
  return (
    <>
      {nodes.map((n, i) => (
        <NodeEl key={i} node={n} cursorIdx={cursorIdx} />
      ))}
    </>
  );
}

function NodeEl({ node, cursorIdx }: { node: DNode; cursorIdx?: number }): ReactNode {
  switch (node.t) {
    case "text":
      return (
        <>
          {cursorIdx !== undefined && node.idx === cursorIdx && <Cursor />}
          <span>{node.s}</span>
        </>
      );
    case "empty":
      return (
        <>
          {cursorIdx !== undefined && node.idx === cursorIdx && <Cursor />}
          <span className="dn-empty" aria-label="empty box" />
        </>
      );
    case "cursor":
      return <Cursor />;
    case "row":
      return <DNodes nodes={node.parts} cursorIdx={cursorIdx} />;
    case "frac":
      return (
        <span className="dn-frac">
          <span className="dn-num"><DNodes nodes={node.num} cursorIdx={cursorIdx} /></span>
          <span className="dn-den"><DNodes nodes={node.den} cursorIdx={cursorIdx} /></span>
        </span>
      );
    case "sup":
      return (
        <span className="dn-sup">
          <DNodes nodes={node.base} cursorIdx={cursorIdx} />
          <span className="dn-pow"><DNodes nodes={node.pow} cursorIdx={cursorIdx} /></span>
        </span>
      );
    case "sub":
      return (
        <span className="dn-sub-r">
          <DNodes nodes={node.base} cursorIdx={cursorIdx} />
          <span className="dn-sub"><DNodes nodes={node.sub} cursorIdx={cursorIdx} /></span>
        </span>
      );
    case "sqrt":
      return (
        <span className="dn-sqrt">
          {node.index && (
            <span className="dn-sqrt-idx"><DNodes nodes={node.index} cursorIdx={cursorIdx} /></span>
          )}
          <span className="dn-sqrt-sign" aria-hidden="true">
            <svg width="0.68em" height="1.32em" viewBox="0 0 16 26" fill="none" aria-hidden="true">
              <path d="M1 15 L5 22 L9 3 L16 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="dn-sqrt-body">
            <DNodes nodes={node.body} cursorIdx={cursorIdx} />
            {cursorIdx !== undefined && node.closePos === cursorIdx && <Cursor />}
          </span>
        </span>
      );
    case "abs":
      return (
        <span className="dn-abs">
          <DNodes nodes={node.body} cursorIdx={cursorIdx} />
          {cursorIdx !== undefined && node.closePos === cursorIdx && <Cursor />}
        </span>
      );
    case "func":
      return (
        <>
          <span>{node.name}</span>
          <span className="dn-group-par">(</span>
          {node.args.map((a, i) => (
            <span key={i}>
              {i > 0 && <span>,&#8202;</span>}
              <DNodes nodes={a} cursorIdx={cursorIdx} />
            </span>
          ))}
          {cursorIdx !== undefined && node.closePos === cursorIdx && <Cursor />}
          <span className="dn-group-par">)</span>
        </>
      );
    case "dms":
      return (
        <>
          {node.parts.map((p, i) => (
            <span key={i}>
              {i > 0 && <span>{["°", "′", "″"][Math.min(i - 1, 2)]}</span>}
              <DNodes nodes={p} cursorIdx={cursorIdx} />
            </span>
          ))}
        </>
      );
    case "bounds":
      return (
        <span className="dn-bounds">
          <span><DNodes nodes={node.lo} cursorIdx={cursorIdx} /></span>
          <span><DNodes nodes={node.hi} cursorIdx={cursorIdx} /></span>
        </span>
      );
    case "matrix": {
      const cols = node.rows[0]?.length ?? 1;
      return (
        <span className="dn-matrix-wrap">
          <span className="dn-matrix" style={{ gridTemplateColumns: `repeat(${cols}, auto)` }}>
            {node.rows.flatMap((row, ri) =>
              row.map((cell, ci) => (
                <span key={`${ri}-${ci}`} style={{ justifySelf: "end" }}>
                  <DNodes nodes={cell} cursorIdx={cursorIdx} />
                </span>
              )),
            )}
          </span>
        </span>
      );
    }
    default:
      return null;
  }
}
