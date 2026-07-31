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

type Props = {
  people: Person[];
  /** Stable tree center (family root or explicit search focus) */
  mainId: string;
  /** Person to highlight without changing what the tree shows */
  highlightId?: string | null;
  /** True when URL root differs from family root (branch-only view) */
  focusedAway?: boolean;
  /** Called when a card is tapped — the tree itself stays untouched */
  onHighlight?: (id: string) => void;
  /** Called only when user explicitly focuses a branch (modal action) */
  onFocusBranch?: (id: string) => void;
  /** Clear highlight, or exit branch view */
  onClearHighlight?: () => void;
  /** Restore full-family root (exit branch filter) */
  onShowFullTree?: () => void;
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
  focusedAway = false,
  onHighlight,
  onFocusBranch,
  onClearHighlight,
  onShowFullTree,
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
  const peopleCount = people.length;

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
  const height = Math.max(280, window.innerHeight - top - 4);
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
  }, [highlightId, mainId, scale, peopleCount]);

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
  }, [highlightId, peopleCount, scale]);

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
    selected && typeof document !== "undefined"
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

      <div className="family-chart-tools" role="toolbar" aria-label="Narzędzia drzewa">
        <button
          type="button"
          className="chart-tool"
          disabled={!highlightId || focusedAway}
          title="Pokaż tylko tę gałąź"
          aria-label="Pokaż tylko tę gałąź"
          onClick={() => {
            if (highlightId) onFocusBranch?.(highlightId);
          }}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
            <path
              fill="currentColor"
              d="M12 3a2 2 0 0 1 2 2v2.2l3.4 2.55A2 2 0 0 1 18.5 13v2.1a2.5 2.5 0 1 1-2 0V13l-3.5-2.6V16.1a2.5 2.5 0 1 1-2 0V10.4L7.5 13v2.1a2.5 2.5 0 1 1-2 0V13a2 2 0 0 1 1.1-1.8L10 8.2V5a2 2 0 0 1 2-2z"
            />
          </svg>
        </button>
        <button
          type="button"
          className="chart-tool"
          disabled={!highlightId && !focusedAway}
          title={focusedAway ? "Pełne drzewo" : "Wyczyść podświetlenie"}
          aria-label={focusedAway ? "Pełne drzewo" : "Wyczyść podświetlenie"}
          onClick={() => {
            if (focusedAway) onShowFullTree?.();
            else onClearHighlight?.();
          }}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
            <path
              fill="currentColor"
              d="M6.4 6.4a1 1 0 0 1 1.4 0L12 10.6l4.2-4.2a1 1 0 1 1 1.4 1.4L13.4 12l4.2 4.2a1 1 0 0 1-1.4 1.4L12 13.4l-4.2 4.2a1 1 0 0 1-1.4-1.4L10.6 12 6.4 7.8a1 1 0 0 1 0-1.4z"
            />
          </svg>
        </button>
        <button
          type="button"
          className="chart-tool"
          title="Całe drzewo w kadrze"
          aria-label="Całe drzewo w kadrze"
          onClick={fitWholeTree}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
            <path
              fill="currentColor"
              d="M4 9V5a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2H6v3a1 1 0 1 1-2 0zm16 0a1 1 0 0 1-2 0V6h-3a1 1 0 1 1 0-2h4a1 1 0 0 1 1 1v4zM9 20H5a1 1 0 0 1-1-1v-4a1 1 0 1 1 2 0v3h3a1 1 0 1 1 0 2zm11-1a1 1 0 0 1-1 1h-4a1 1 0 1 1 0-2h3v-3a1 1 0 1 1 2 0v4z"
            />
          </svg>
        </button>
        <button
          type="button"
          className="chart-tool"
          disabled={!highlightId}
          title="Wróć do podświetlonej osoby"
          aria-label="Wróć do podświetlonej osoby"
          onClick={() => {
            if (highlightId) panToCard(highlightId);
          }}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
            <path
              fill="currentColor"
              d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zm0 2a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm0 3.5a1 1 0 0 1 1 1V11h1.5a1 1 0 1 1 0 2H13v1.5a1 1 0 1 1-2 0V13H9.5a1 1 0 1 1 0-2H11V9.5a1 1 0 0 1 1-1z"
            />
          </svg>
        </button>
      </div>

      {highlightId || focusedAway ? (
        <p className="family-chart-status" role="status">
          {focusedAway ? "Gałąź" : "Podświetlone"}
        </p>
      ) : null}

      {personModal}
    </div>
  );
}
