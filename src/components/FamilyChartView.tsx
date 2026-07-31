"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import * as f3 from "family-chart";
import "family-chart/styles/family-chart.css";
import type { Person } from "@/types/family";
import { peopleToFamilyChartData } from "@/lib/familyChartData";
import { displayName, formatPolishDate, lifespan } from "@/lib/db-client";
import { useTextScale, type TextScaleId } from "@/components/TextScaleProvider";
import {
  GraphEditWizard,
  type GraphEditOp,
} from "@/components/GraphEditWizard";

type Props = {
  people: Person[];
  /** Stable tree center (family root or explicit search focus) */
  mainId: string;
  /** Person to highlight without changing what the tree shows */
  highlightId?: string | null;
  /** Called when a card is tapped — the tree itself stays untouched */
  onHighlight?: (id: string) => void;
  /** Called only when user explicitly focuses a branch (modal action) */
  onFocusBranch?: (id: string) => void;
  /** Called when the highlighted person is not part of the rendered tree */
  onHighlightMissing?: (id: string) => void;
};

const SCALE_LAYOUT: Record<
  TextScaleId,
  { w: number; h: number; xSpace: number; ySpace: number; font: number }
> = {
  normal: { w: 220, h: 78, xSpace: 250, ySpace: 250, font: 13 },
  large: { w: 260, h: 96, xSpace: 300, ySpace: 290, font: 16 },
  xlarge: { w: 300, h: 112, xSpace: 350, ySpace: 330, font: 18 },
};

/** Minimum zoom when jumping to a searched person, so the card stays readable */
const READABLE_ZOOM = 0.7;

type ZoomTransform = {
  k: number;
  x: number;
  y: number;
  translate: (x: number, y: number) => ZoomTransform;
  scale: (k: number) => ZoomTransform;
};

type ZoomHost = Element & {
  __zoomObj?: { on: (type: string) => ((e: unknown) => void) | undefined };
  __zoom?: ZoomTransform;
};

export function FamilyChartView({
  people,
  mainId,
  highlightId = null,
  onHighlight,
  onFocusBranch,
  onHighlightMissing,
}: Props) {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof f3.createChart> | null>(null);
  const cardRef = useRef<ReturnType<
    ReturnType<typeof f3.createChart>["setCardHtml"]
  > | null>(null);
  const peopleRef = useRef(people);
  const mainIdRef = useRef(mainId);
  const highlightRef = useRef<string | null>(highlightId);
  /** Set when the highlight came from a tap — no need to slide the view then */
  const skipPanRef = useRef<string | null>(null);

  const { scale } = useTextScale();
  const [selected, setSelected] = useState<Person | null>(null);
  const [editOp, setEditOp] = useState<GraphEditOp | null>(null);
  const [editNotice, setEditNotice] = useState<string | null>(null);
  const peopleCount = people.length;
  /** Rebuild when links change, not only when a person is added */
  const peopleSig = people
    .map(
      (p) =>
        `${p.id}:${p.parentIds.join(",")}:${p.spouseIds.join(",")}:${p.firstName}:${p.lastName}`,
    )
    .join("|");

  useEffect(() => {
    peopleRef.current = people;
    mainIdRef.current = mainId;
    highlightRef.current = highlightId;
  });

  /** Bars above the canvas come and go — keep it inside the window */
  const syncCanvasHeight = () => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const top = wrap.getBoundingClientRect().top;
    const height = Math.max(360, window.innerHeight - top - 16);
    wrap.style.height = `${height}px`;
  };

  useEffect(() => {
    syncCanvasHeight();
    window.addEventListener("resize", syncCanvasHeight);
    return () => window.removeEventListener("resize", syncCanvasHeight);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    syncCanvasHeight();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightId, mainId, scale, peopleSig]);

  /** Card wrappers carry the tree datum in d3's __data__ — match on person id */
  const findCardNodes = (id: string): Element[] => {
    const el = containerRef.current;
    if (!el) return [];
    return Array.from(el.querySelectorAll(".card_cont")).filter((node) => {
      const datum = (node as Element & { __data__?: { data?: { id?: string } } })
        .__data__;
      return datum?.data?.id === id;
    });
  };

  const applyHighlight = () => {
    const el = containerRef.current;
    if (!el) return;
    el.querySelectorAll(".is-chart-highlight").forEach((node) => {
      node.classList.remove("is-chart-highlight");
    });
    const id = highlightRef.current;
    if (!id) return;
    // Both the svg group and the html wrapper can back one person
    findCardNodes(id).forEach((node) => {
      node.classList.add("is-chart-highlight");
    });
  };

  /** Drive the chart's own d3 zoom so svg links and html cards stay in sync */
  const setViewTransform = (k: number, x: number, y: number): boolean => {
    const svg = chartRef.current?.svg as ZoomHost | undefined;
    if (!svg) return false;
    const host: ZoomHost | null = svg.__zoomObj
      ? svg
      : ((svg.parentNode as ZoomHost | null) ?? null);
    const zoomObj = host?.__zoomObj;
    const current = host?.__zoom;
    if (!host || !zoomObj || !current) return false;

    const next = current
      .scale(k / current.k)
      .translate((x - current.x) / k, (y - current.y) / k);
    host.__zoom = next;
    zoomObj.on("zoom")?.({ transform: next });
    return true;
  };

  const viewportRect = (): DOMRect | null => {
    const rect = containerRef.current?.getBoundingClientRect();
    return rect && rect.width && rect.height ? rect : null;
  };

  /**
   * Pan (and gently zoom in) to a card without re-rooting the tree.
   * "missing" means the person is not part of the rendered tree at all.
   */
  const panToCard = (id: string): "ok" | "missing" | "unavailable" => {
    const chart = chartRef.current;
    if (!chart) return "unavailable";
    const datum = chart.store.getTreeDatum?.(id);
    if (!datum) return "missing";

    const rect = viewportRect();
    const currentK = (chart.svg as ZoomHost).__zoomObj
      ? (chart.svg as ZoomHost).__zoom?.k
      : ((chart.svg as ZoomHost).parentNode as ZoomHost | null)?.__zoom?.k;
    if (!rect) return "unavailable";

    const k = Math.max(currentK ?? 1, READABLE_ZOOM);
    const ok = setViewTransform(
      k,
      rect.width / 2 - datum.x * k,
      rect.height / 2 - datum.y * k,
    );
    return ok ? "ok" : "unavailable";
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !peopleRef.current.length) return;

    el.innerHTML = "";
    const layout = SCALE_LAYOUT[scale] ?? SCALE_LAYOUT.normal;
    el.style.setProperty("--f3-card-font", `${layout.font}px`);

    const livePeople = peopleRef.current;
    const data = peopleToFamilyChartData(livePeople);
    const centerId = mainIdRef.current;
    const safeMain = data.some((d) => d.id === centerId)
      ? centerId
      : data[0]?.id;
    if (!safeMain) return;

    const chart = f3.createChart(el, data);
    chart.setTransitionTime(250);
    chart.setSingleParentEmptyCard(false);
    chart.setCardXSpacing(layout.xSpace);
    chart.setCardYSpacing(layout.ySpace);
    chart.afterUpdate = () => {
      el.querySelectorAll("path.link").forEach((path) => {
        path.setAttribute("stroke", "#5f7a6a");
        path.setAttribute("stroke-width", "2.5");
        path.setAttribute("fill", "none");
      });
      applyHighlight();
    };

    const card = chart.setCardHtml();
    cardRef.current = card;
    card.setCardDim({
      w: layout.w,
      h: layout.h,
      text_x: 75,
      text_y: 15,
      img_w: 60,
      img_h: 60,
      img_x: 5,
      img_y: 5,
    });
    card.setCardDisplay([
      ["first name", "last name"],
      ["maiden"],
      ["birthday"],
      ["death"],
    ]);
    card.setOnCardClick((_e: MouseEvent, d: { data?: { id?: string } }) => {
      const id = d?.data?.id;
      if (!id) return;
      const person = peopleRef.current.find((p) => p.id === id) ?? null;
      skipPanRef.current = id;
      highlightRef.current = id;
      applyHighlight();
      setSelected(person);
      onHighlight?.(id);
    });

    chart.updateMainId(safeMain);
    chart.updateTree({ initial: true, tree_position: "fit" });
    chartRef.current = chart;

    return () => {
      chartRef.current = null;
      cardRef.current = null;
      el.innerHTML = "";
    };
    // Full rebuild only when the person set changes — scale is handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peopleCount]);

  // Text scale: resize cards without destroying the whole chart
  useEffect(() => {
    const chart = chartRef.current;
    const card = cardRef.current;
    const el = containerRef.current;
    if (!chart || !card || !el) return;
    const layout = SCALE_LAYOUT[scale] ?? SCALE_LAYOUT.normal;
    el.style.setProperty("--f3-card-font", `${layout.font}px`);
    chart.setCardXSpacing(layout.xSpace);
    chart.setCardYSpacing(layout.ySpace);
    card.setCardDim({
      w: layout.w,
      h: layout.h,
      text_x: 75,
      text_y: 15,
      img_w: 60,
      img_h: 60,
      img_x: 5,
      img_y: 5,
    });
    chart.updateTree({ tree_position: "inherit" });
  }, [scale]);

  // Explicit branch focus (deep link ?root=) — recenter the tree around a person
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !mainId) return;
    chart.updateMainId(mainId);
    chart.updateTree({ tree_position: "main_to_middle" });
  }, [mainId]);

  // Highlight — mark the card and slide the view onto it
  useEffect(() => {
    if (!chartRef.current) return;
    highlightRef.current = highlightId;
    applyHighlight();
    if (!highlightId) return;
    if (skipPanRef.current === highlightId) {
      // Tapped card is already on screen
      skipPanRef.current = null;
      return;
    }
    const timer = window.setTimeout(() => {
      const status = panToCard(highlightId);
      applyHighlight();
      // Only re-root when the person really is outside the rendered tree
      if (status === "missing") onHighlightMissing?.(highlightId);
    }, 80);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightId, peopleSig, scale]);

  /** Zoom out until every generation fits inside the visible canvas */
  const fitWholeTree = () => {
    const dim = chartRef.current?.store.getTree?.()?.dim;
    const rect = viewportRect();
    if (!dim || !rect || !dim.width || !dim.height) {
      chartRef.current?.updateTree({ tree_position: "fit" });
      return;
    }
    const pad = 24;
    const k = Math.min(
      (rect.width - pad * 2) / dim.width,
      (rect.height - pad * 2) / dim.height,
      1,
    );
    setViewTransform(
      k,
      k * dim.x_off + (rect.width - dim.width * k) / 2,
      k * dim.y_off + (rect.height - dim.height * k) / 2,
    );
  };

  const goToPerson = () => {
    if (!selected) return;
    const id = selected.id;
    setSelected(null);
    router.push(`/osoba/${encodeURIComponent(id)}`);
  };

  const focusInTree = () => {
    if (!selected) return;
    const id = selected.id;
    setSelected(null);
    onFocusBranch?.(id);
  };

  // Portal to <body> — the chart wrap has overflow:hidden + d3 zoom, which
  // steals touch scrolls on mobile if the dialog stays inside it.
  useEffect(() => {
    if (!selected) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [selected]);

  const personModal =
    selected && !editOp && typeof document !== "undefined"
      ? createPortal(
          <div
            className="modal-backdrop graph-person-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="graph-person-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelected(null);
            }}
          >
            <div
              className="modal-card graph-person-modal"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <div className="graph-person-modal__scroll">
                <header className="modal-card__head">
                  <p className="graph-person-modal__label">Wybrana osoba</p>
                  <h2 id="graph-person-title">{displayName(selected)}</h2>
                  {selected.maidenName && (
                    <p className="graph-person-modal__maiden">
                      z d. {selected.maidenName}
                    </p>
                  )}
                  <p className="modal-card__head p-reset">
                    {lifespan(selected) || "Brak dat"}
                  </p>
                </header>

                <dl className="graph-person-modal__facts">
                  <div>
                    <dt>Urodzenie</dt>
                    <dd>{formatPolishDate(selected.birthDate) || "—"}</dd>
                  </div>
                  <div>
                    <dt>Zgon</dt>
                    <dd>{formatPolishDate(selected.deathDate) || "—"}</dd>
                  </div>
                  <div>
                    <dt>Płeć</dt>
                    <dd>
                      {selected.gender === "male"
                        ? "mężczyzna"
                        : selected.gender === "female"
                          ? "kobieta"
                          : "—"}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="modal-actions modal-actions--stack graph-person-modal__actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    goToPerson();
                  }}
                >
                  Przejdź do widoku osoby
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    focusInTree();
                  }}
                >
                  Pokaż tylko tę gałąź
                </button>
                <div className="graph-person-modal__edit">
                  <p className="graph-person-modal__edit-label">
                    Zarządzaj powiązaniami
                  </p>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setEditOp("add_child");
                    }}
                  >
                    Dodaj dziecko
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setEditOp("link_spouse");
                    }}
                  >
                    Połącz z osobą
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setEditOp("reparent");
                    }}
                  >
                    Przenieś w drzewie
                  </button>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelected(null);
                  }}
                >
                  Zamknij
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="family-chart-wrap" id="family-tree-canvas" ref={wrapRef}>
      <div
        ref={containerRef}
        id="FamilyChart"
        className={`f3 family-chart-host family-chart-host--${scale}`}
        data-text-scale={scale}
      />

      <div className="family-chart-tools">
        <button
          type="button"
          className="btn btn-secondary btn-mini"
          onClick={fitWholeTree}
        >
          ⤢ Całe drzewo<span className="only-wide"> w kadrze</span>
        </button>
        {highlightId && (
          <button
            type="button"
            className="btn btn-secondary btn-mini"
            onClick={() => panToCard(highlightId)}
          >
            ◎ <span className="only-wide">Wróć do </span>podświetlonej
            <span className="only-wide"> osoby</span>
          </button>
        )}
      </div>

      <p className="family-chart-hint">
        Przeciągnij, aby przesunąć · scroll = zoom · klik = szczegóły osoby
      </p>

      {editNotice && (
        <p className="family-chart-toast" role="status">
          {editNotice}
        </p>
      )}

      {personModal}

      {selected && editOp && (
        <GraphEditWizard
          open
          op={editOp}
          anchor={selected}
          people={people}
          onClose={() => setEditOp(null)}
          onApplied={({ summary, createdPersonId }) => {
            setSelected(null);
            setEditOp(null);
            setEditNotice(summary);
            if (createdPersonId) onHighlight?.(createdPersonId);
            window.setTimeout(() => setEditNotice(null), 6000);
          }}
        />
      )}
    </div>
  );
}
