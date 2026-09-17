"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as f3 from "family-chart";
import "family-chart/styles/family-chart.css";
import type { Person } from "@/types/family";
import { peopleToFamilyChartData } from "@/lib/familyChartData";
import { separateChartLinks } from "@/lib/chartLinks";
import { useTextScale, type TextScaleId } from "@/components/TextScaleProvider";
import { GraphEditHost } from "@/components/GraphEditHost";
import { TreeWind } from "@/components/TreeWind";

type Props = {
  people: Person[];
  /** Stable tree center (family root or explicit search focus) */
  mainId: string;
  /** Person to highlight without changing what the tree shows */
  highlightId?: string | null;
  /** People with an RSVP for the family gathering (orange border) */
  attendingPersonIds?: string[];
  /** Full-tree view: fit every generation instead of centering on main */
  overview?: boolean;
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
  normal: { w: 220, h: 78, xSpace: 270, ySpace: 300, font: 13 },
  large: { w: 260, h: 96, xSpace: 320, ySpace: 340, font: 16 },
  xlarge: { w: 300, h: 112, xSpace: 370, ySpace: 380, font: 18 },
};

/** Minimum zoom when jumping to a searched person, so the card stays readable */
const READABLE_ZOOM = 0.7;

const PERSON_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" style="fill: currentColor" data-icon="person"><g data-icon="person"><path d="M256 288c79.5 0 144-64.5 144-144S335.5 0 256 0 112 64.5 112 144s64.5 144 144 144zm128 32h-55.1c-22.2 10.2-46.9 16-72.9 16s-50.6-5.8-72.9-16H128C57.3 320 0 377.3 0 448v16c0 26.5 21.5 48 48 48h416c26.5 0 48-21.5 48-48v-16c0-70.7-57.3-128-128-128z" /></g></svg>`;

function replaceBrokenChartPhoto(img: HTMLImageElement) {
  const icon = document.createElement("div");
  icon.className = "person-icon";
  icon.innerHTML = PERSON_ICON_SVG;
  img.replaceWith(icon);
}

function plusButtonAt(host: HTMLElement, x: number, y: number): HTMLButtonElement | null {
  const pluses = host.querySelectorAll<HTMLButtonElement>(".chart-card-plus");
  let hit: HTMLButtonElement | null = null;
  pluses.forEach((btn) => {
    const r = btn.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) hit = btn;
  });
  return hit;
}

function liftPlusCard(host: HTMLElement, hit: HTMLButtonElement | null) {
  host.querySelectorAll(".card_cont--plus-top").forEach((node) => {
    node.classList.remove("card_cont--plus-top");
  });
  hit?.closest(".card_cont")?.classList.add("card_cont--plus-top");
}

function bindChartPhotoFallback(img: HTMLImageElement) {
  if (img.dataset.photoFallback === "1") return;
  img.dataset.photoFallback = "1";
  const fallback = () => {
    if (!img.isConnected) return;
    replaceBrokenChartPhoto(img);
  };
  img.addEventListener("error", fallback);
  if (img.complete && img.naturalWidth === 0) fallback();
}

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
  attendingPersonIds = [],
  overview = false,
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
  const attendingRef = useRef(new Set(attendingPersonIds));
  const pendingRef = useRef(
    new Set(people.filter((p) => p.pending).map((p) => p.id)),
  );
  const overviewRef = useRef(overview);
  /** Set when the highlight came from a tap — no need to slide the view then */
  const skipPanRef = useRef<string | null>(null);

  const { scale } = useTextScale();
  const [selected, setSelected] = useState<Person | null>(null);
  /** Rebuild when links change, not only when a person is added */
  const peopleSig = people
    .map(
      (p) =>
        `${p.id}:${p.parentIds.join(",")}:${p.spouseIds.join(",")}:${p.firstName}:${p.lastName}:${p.birthDate ?? ""}:${p.deathDate ?? ""}:${p.photoUrl ?? ""}:${p.pending ? "1" : "0"}`,
    )
    .join("|");

  useEffect(() => {
    peopleRef.current = people;
    mainIdRef.current = mainId;
    highlightRef.current = highlightId;
    attendingRef.current = new Set(attendingPersonIds);
    pendingRef.current = new Set(
      people.filter((p) => p.pending).map((p) => p.id),
    );
    overviewRef.current = overview;
  });

  /** Bars above the canvas come and go — keep it inside the window */
  const syncCanvasHeight = () => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const top = wrap.getBoundingClientRect().top;
    const height = Math.max(360, window.innerHeight - top);
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

  const applyAttending = () => {
    const el = containerRef.current;
    if (!el) return;
    el.querySelectorAll(".card_cont").forEach((node) => {
      const datum = (node as Element & { __data__?: { data?: { id?: string } } })
        .__data__;
      const id = datum?.data?.id;
      node.classList.toggle(
        "is-attending",
        Boolean(id && attendingRef.current.has(id)),
      );
      node.classList.toggle(
        "is-pending",
        Boolean(id && pendingRef.current.has(id)),
      );
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

  /**
   * family-chart's own zoom tween is duration + 100ms delay. A single early
   * pan gets overwritten and the user is left looking at the apex.
   */
  const scheduleFocus = (id: string, reportMissing: boolean) => {
    const delays = [80, 220, 500];
    const timers = delays.map((ms, index) =>
      window.setTimeout(() => {
        applyHighlight();
        applyAttending();
        const status = panToCard(id);
        if (
          reportMissing &&
          status === "missing" &&
          index === delays.length - 1
        ) {
          onHighlightMissing?.(id);
        }
      }, ms),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  };

  const openPersonActions = (id: string) => {
    const person = peopleRef.current.find((p) => p.id === id) ?? null;
    if (!person) return;
    skipPanRef.current = id;
    highlightRef.current = id;
    applyHighlight();
    applyAttending();
    setSelected(person);
    onHighlight?.(id);
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
    const keepHighlight = highlightRef.current;
    chart.setTransitionTime(keepHighlight ? 0 : 250);
    chart.setSingleParentEmptyCard(false);
    chart.setSortChildrenFunction((a, b) => {
      const aDate = String(a.data.birthday ?? "").trim();
      const bDate = String(b.data.birthday ?? "").trim();
      if (aDate !== bDate) {
        if (!aDate) return 1;
        if (!bDate) return -1;
        return aDate.localeCompare(bDate);
      }
      const aName = `${a.data["last name"] ?? ""} ${a.data["first name"] ?? ""}`;
      const bName = `${b.data["last name"] ?? ""} ${b.data["first name"] ?? ""}`;
      return String(aName).localeCompare(String(bName), "pl");
    });
    chart.setShowSiblingsOfMain(true);
    chart.setAncestryDepth(100);
    chart.setProgenyDepth(100);
    chart.setCardXSpacing(layout.xSpace);
    chart.setCardYSpacing(layout.ySpace);
    let linkTimer = 0;
    const paintLinks = () => {
      el.querySelectorAll("path.link").forEach((path) => {
        if (!path.classList.contains("f3-path-to-main")) {
          path.setAttribute("stroke", "#8aa392");
          path.setAttribute("stroke-width", "2.25");
        }
        path.setAttribute("fill", "none");
      });
      separateChartLinks(el);
    };
    chart.afterUpdate = () => {
      paintLinks();
      window.clearTimeout(linkTimer);
      linkTimer = window.setTimeout(paintLinks, 280);
      applyHighlight();
      applyAttending();
    };

    const card = chart.setCardHtml();
    cardRef.current = card;
    card.setCardDim({
      w: layout.w,
      h: layout.h,
      text_x: 75,
      text_y: 15,
      img_w: 56,
      img_h: 56,
      img_x: 0,
      img_y: 0,
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
      openPersonActions(id);
    });
    card.setOnCardUpdate(function (
      this: HTMLElement,
      d: { data?: { id?: string } },
    ) {
      const id = d?.data?.id;
      if (!id) return;
      let btn = this.querySelector<HTMLButtonElement>(".chart-card-plus");
      if (!btn) {
        btn = document.createElement("button");
        btn.type = "button";
        btn.className = "chart-card-plus";
        btn.setAttribute("aria-label", "Dodaj powiązanie");
        btn.title = "Dodaj powiązanie";
        btn.textContent = "+";
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          e.preventDefault();
          openPersonActions(id);
        });
        this.classList.add("card_cont--addable");
        this.appendChild(btn);
      }

      const photo = this.querySelector("img");
      if (photo) bindChartPhotoFallback(photo);
      this.classList.toggle("is-attending", attendingRef.current.has(id));
      this.classList.toggle("is-pending", pendingRef.current.has(id));
    });

    chart.updateMainId(safeMain);
    // `initial: true` always fits the whole tree. A mid-tree ancestor like
    // Wincenty has ~400 cards and a 50k-px layout — fit shrinks cards to a
    // few pixels and the canvas looks empty. Focused "widok wokół" and a
    // kept highlight on the full tree must stay at a readable zoom.
    const fitWhole = overviewRef.current && !keepHighlight;
    try {
      chart.updateTree({
        initial: false,
        tree_position: fitWhole ? "fit" : "main_to_middle",
      });
    } catch (err) {
      console.error("family-chart updateTree failed", err);
      chart.updateTree({
        initial: false,
        tree_position: "main_to_middle",
      });
    }
    chart.setTransitionTime(250);
    chartRef.current = chart;
    const cancelInitialFocus = keepHighlight
      ? scheduleFocus(keepHighlight, keepHighlight !== safeMain)
      : undefined;

    /** Neighbor cards sit in later stacking contexts and steal clicks from the plus. */
    const onPlusPointerDown = (e: PointerEvent) => {
      const hit = plusButtonAt(el, e.clientX, e.clientY);
      liftPlusCard(el, hit);
      if (!hit) return;
      if (e.target instanceof Element && hit.contains(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      hit.click();
    };
    const onPlusPointerLeave = () => liftPlusCard(el, null);
    el.addEventListener("pointerdown", onPlusPointerDown, true);
    el.addEventListener("pointerleave", onPlusPointerLeave);

    return () => {
      cancelInitialFocus?.();
      window.clearTimeout(linkTimer);
      el.removeEventListener("pointerdown", onPlusPointerDown, true);
      el.removeEventListener("pointerleave", onPlusPointerLeave);
      chartRef.current = null;
      cardRef.current = null;
      el.innerHTML = "";
    };
    // Full rebuild when people or links change — scale is handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peopleSig]);

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
      img_w: 56,
      img_h: 56,
      img_x: 0,
      img_y: 0,
    });
    chart.updateTree({ tree_position: "inherit" });
  }, [scale]);

  // Explicit branch focus (deep link ?root=) — recenter the tree around a person.
  // Returning to the family root keeps the current highlight and pans to that person
  // at a readable zoom — never fit-to-window first, or the card becomes a speck.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !mainId) return;
    chart.updateMainId(mainId);
    const keep = highlightRef.current;
    if (keep && keep !== mainId) {
      chart.setTransitionTime(0);
      try {
        chart.updateTree({ tree_position: "main_to_middle" });
      } catch (err) {
        console.error("family-chart updateTree failed", err);
        chart.updateTree({ tree_position: "main_to_middle" });
      }
      chart.setTransitionTime(250);
      return scheduleFocus(keep, true);
    }
    try {
      chart.updateTree({
        tree_position: overview && !keep ? "fit" : "main_to_middle",
      });
    } catch (err) {
      console.error("family-chart updateTree failed", err);
      chart.updateTree({ tree_position: "main_to_middle" });
    }
    // applyHighlight / panToCard close over DOM nodes rebuilt with the chart
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainId, overview]);

  // Highlight — mark the card and slide the view onto it
  useEffect(() => {
    if (!chartRef.current) return;
    highlightRef.current = highlightId;
    applyHighlight();
    applyAttending();
    if (!highlightId) return;
    if (skipPanRef.current === highlightId) {
      // Tapped card is already on screen
      skipPanRef.current = null;
      return;
    }
    return scheduleFocus(highlightId, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightId, peopleSig, scale, mainId]);

  useEffect(() => {
    attendingRef.current = new Set(attendingPersonIds);
    applyAttending();
  }, [attendingPersonIds, peopleSig]);

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

  const goToPerson = useCallback(
    (person: Person) => {
      setSelected(null);
      router.push(`/osoba/${encodeURIComponent(person.id)}`);
    },
    [router],
  );

  const focusInTree = useCallback(
    (person: Person) => {
      setSelected(null);
      onFocusBranch?.(person.id);
    },
    [onFocusBranch],
  );

  const closeSelected = useCallback(() => setSelected(null), []);

  const handleApplied = useCallback(
    ({ createdPersonId }: { createdPersonId?: string }) => {
      if (createdPersonId) onHighlight?.(createdPersonId);
    },
    [onHighlight],
  );

  return (
    <div className="family-chart-wrap" id="family-tree-canvas" ref={wrapRef}>
      <TreeWind />
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
          <span className="only-narrow">⤢ Całe drzewo</span>
          <span className="only-wide">⤢ Całe drzewo w kadrze</span>
        </button>
        {highlightId && (
          <button
            type="button"
            className="btn btn-secondary btn-mini"
            onClick={() => panToCard(highlightId)}
          >
            <span className="only-narrow">◎ Podświetlona</span>
            <span className="only-wide">◎ Wróć do podświetlonej osoby</span>
          </button>
        )}
        {attendingPersonIds.length > 0 && (
          <span className="attending-legend" title="Osoby zapisane na spotkanie rodzinne">
            Pomarańczowa ramka — idą na spotkanie
          </span>
        )}
        {people.some((p) => p.pending) && (
          <span className="pending-legend" title="Osoby dodane roboczo, czekają na akceptację">
            Szara karta — roboczo, jeszcze niezaakceptowane
          </span>
        )}
      </div>

      <p className="family-chart-hint">
        Przeciągnij, aby przesunąć · scroll = zoom · + na karcie = powiązanie
      </p>

      <GraphEditHost
        people={people}
        person={selected}
        onClose={closeSelected}
        onViewPerson={goToPerson}
        onFocusBranch={focusInTree}
        onApplied={handleApplied}
      />
    </div>
  );
}
