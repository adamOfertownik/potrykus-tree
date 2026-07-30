"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as f3 from "family-chart";
import "family-chart/styles/family-chart.css";
import type { Person } from "@/types/family";
import { peopleToFamilyChartData } from "@/lib/familyChartData";
import { displayName, formatPolishDate, lifespan } from "@/lib/db-client";

type Props = {
  people: Person[];
  mainId: string;
  onMainChange?: (id: string) => void;
};

export function FamilyChartView({ people, mainId, onMainChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof f3.createChart> | null>(null);
  const onMainChangeRef = useRef(onMainChange);
  const peopleRef = useRef(people);
  onMainChangeRef.current = onMainChange;
  peopleRef.current = people;

  const [selected, setSelected] = useState<Person | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !people.length) return;

    el.innerHTML = "";
    const data = peopleToFamilyChartData(people);
    const safeMain = data.some((d) => d.id === mainId) ? mainId : data[0]?.id;
    if (!safeMain) return;

    const chart = f3.createChart(el, data);
    chart.setTransitionTime(250);
    chart.setSingleParentEmptyCard(false);
    chart.afterUpdate = () => {
      el.querySelectorAll("path.link").forEach((path) => {
        path.setAttribute("stroke", "#5f7a6a");
        path.setAttribute("stroke-width", "2.5");
        path.setAttribute("fill", "none");
      });
    };

    const card = chart.setCardHtml();
    card.setCardDisplay([
      ["first name", "last name"],
      ["maiden"],
      ["birthday"],
      ["death"],
    ]);
    card.setOnCardClick((_e: MouseEvent, d: { data?: { id?: string } }) => {
      const id = d?.data?.id;
      if (!id) return;
      onMainChangeRef.current?.(id);
      chart.updateMainId(id);
      chart.updateTree({ tree_position: "main_to_middle" });
      const person = peopleRef.current.find((p) => p.id === id) ?? null;
      setSelected(person);
    });

    chart.updateMainId(safeMain);
    chart.updateTree({ initial: true, tree_position: "fit" });
    chartRef.current = chart;

    return () => {
      chartRef.current = null;
      el.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !mainId) return;
    chart.updateMainId(mainId);
    chart.updateTree({ tree_position: "main_to_middle" });
  }, [mainId]);

  return (
    <div className="family-chart-wrap" id="family-tree-canvas">
      <div
        ref={containerRef}
        id="FamilyChart"
        className="f3 family-chart-host"
      />
      <p className="family-chart-hint">
        Przeciągnij, aby przesunąć · scroll = zoom · klik = wybór osoby
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
          <div className="modal-card graph-person-modal">
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
              <Link
                href={`/osoba/${selected.id}`}
                className="btn btn-primary"
                onClick={() => setSelected(null)}
              >
                Przejdź do widoku osoby
              </Link>
              <Link
                href={`/drzewo?root=${encodeURIComponent(selected.id)}`}
                className="btn btn-secondary"
                onClick={() => setSelected(null)}
              >
                Ustaw jako fokus w drzewie
              </Link>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelected(null)}
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
