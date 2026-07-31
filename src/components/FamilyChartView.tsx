"use client";

import { useEffect, useRef, useState } from "react";
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
  /** Called only when user explicitly focuses a branch (search / modal action) */
  onFocusBranch?: (id: string) => void;
};

const SCALE_LAYOUT: Record<
  TextScaleId,
  { w: number; h: number; xSpace: number; ySpace: number; font: number }
> = {
  normal: { w: 220, h: 78, xSpace: 250, ySpace: 250, font: 13 },
  large: { w: 260, h: 96, xSpace: 300, ySpace: 290, font: 16 },
  xlarge: { w: 300, h: 112, xSpace: 350, ySpace: 330, font: 18 },
};

export function FamilyChartView({ people, mainId, onFocusBranch }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof f3.createChart> | null>(null);
  const peopleRef = useRef(people);
  const mainIdRef = useRef(mainId);
  peopleRef.current = people;
  mainIdRef.current = mainId;

  const { scale } = useTextScale();
  const [selected, setSelected] = useState<Person | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const peopleCount = people.length;

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
      // Mark selected card for CSS highlight without re-rooting
      const hid = highlightId;
      el.querySelectorAll(".card").forEach((node) => {
        node.classList.remove("is-chart-selected");
      });
      if (hid) {
        const cardEl =
          el.querySelector(`[data-id="${hid}"]`) ||
          el.querySelector(`.card[data-id="${hid}"]`);
        cardEl?.classList.add("is-chart-selected");
      }
    };

    const card = chart.setCardHtml();
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
      // Select + highlight only — keep full tree, do not re-filter branch
      const person = peopleRef.current.find((p) => p.id === id) ?? null;
      setHighlightId(id);
      setSelected(person);
      el.querySelectorAll(".card").forEach((node) => {
        node.classList.remove("is-chart-selected");
      });
      const target = (_e.target as HTMLElement | null)?.closest?.(".card");
      target?.classList.add("is-chart-selected");
    });

    chart.updateMainId(safeMain);
    chart.updateTree({ initial: true, tree_position: "fit" });
    chartRef.current = chart;

    return () => {
      chartRef.current = null;
      el.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, peopleCount]);

  // Explicit focus (search / “fokus w drzewie”) — recenter around person
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !mainId) return;
    chart.updateMainId(mainId);
    chart.updateTree({ tree_position: "main_to_middle" });
  }, [mainId]);

  const goToPerson = () => {
    if (!selected) return;
    const id = selected.id;
    setSelected(null);
    window.location.assign(`/osoba/${encodeURIComponent(id)}`);
  };

  const focusInTree = () => {
    if (!selected) return;
    const id = selected.id;
    setSelected(null);
    setHighlightId(id);
    onFocusBranch?.(id);
  };

  return (
    <div className="family-chart-wrap" id="family-tree-canvas">
      <div
        ref={containerRef}
        id="FamilyChart"
        className={`f3 family-chart-host family-chart-host--${scale}`}
        data-text-scale={scale}
      />
      <p className="family-chart-hint">
        Przeciągnij, aby przesunąć · scroll = zoom · klik = wybór (całe drzewo
        zostaje)
      </p>

      {selected && (
        <div
          className="modal-backdrop"
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
          >
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

            <div className="modal-actions modal-actions--stack">
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
                Ustaw jako fokus w drzewie
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
        </div>
      )}
    </div>
  );
}
