"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import * as f3 from "family-chart";
import "family-chart/styles/family-chart.css";
import type { Person } from "@/types/family";
import { peopleToFamilyChartData } from "@/lib/familyChartData";

type Props = {
  people: Person[];
  mainId: string;
  onMainChange?: (id: string) => void;
};

export function FamilyChartView({ people, mainId, onMainChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof f3.createChart> | null>(null);
  const router = useRouter();
  const onMainChangeRef = useRef(onMainChange);
  onMainChangeRef.current = onMainChange;

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
    });

    chart.updateMainId(safeMain);
    chart.updateTree({ initial: true, tree_position: "fit" });
    chartRef.current = chart;

    return () => {
      chartRef.current = null;
      el.innerHTML = "";
    };
    // Recreate chart when dataset changes
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
        onDoubleClick={(ev) => {
          const target = ev.target as HTMLElement | null;
          const cardEl = target?.closest?.("[data-id]") as HTMLElement | null;
          const id = cardEl?.getAttribute("data-id");
          if (id) router.push(`/osoba/${id}`);
        }}
      />
      <p className="family-chart-hint">
        Przeciągnij, aby przesunąć · scroll = zoom · klik = fokus · podwójny
        klik = karta osoby
      </p>
    </div>
  );
}
