import type { DaySheet, Section } from "@/lib/parseOrders";
import { getTrofeuImage } from "@/lib/trofeuImages";

function Checkbox() {
  return <span className="checkbox-print" aria-hidden />;
}

function SectionBlock({ section }: { section: Section }) {
  return (
    <div className="avoid-break section-block mb-4">
      <h3 className="text-base font-bold border-b border-foreground/30 pb-1 mb-2 flex items-center gap-2">
        <span>{section.emoji}</span>
        <span>{section.title}</span>
      </h3>
      <div className="space-y-3 pl-1">
        {section.groups.map((g, i) => {
          const img = section.key === "trofeus" && g.variation ? getTrofeuImage(g.variation) : null;
          return (
            <div key={i} className="avoid-break group-block">
              {g.variation && (
                <div className="flex items-center gap-2 mb-1 variation-header">
                  {img && (
                    <img
                      src={img}
                      alt={g.variation}
                      className="trofeu-thumb w-10 h-10 object-contain rounded border border-foreground/20 bg-white"
                    />
                  )}
                  <span className="font-semibold text-sm">{g.variation}</span>
                </div>
              )}
              <ul className="pl-2 space-y-0.5">
                {g.items.map((it, j) => (
                  <li key={j} className="item-row flex items-center text-sm leading-tight">
                    <Checkbox />
                    <span className="flex-1">{it.name}</span>
                    <span className="font-mono font-semibold ml-2">
                      {it.qty}
                      {it.unit ? ` ${it.unit}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ConsolidatedSheet({ sections }: { sections: Section[] }) {
  return (
    <div className="avoid-break consolidated-card border-2 border-foreground rounded-lg p-5 mb-6 bg-card">
      <div className="flex items-center justify-between border-b-2 border-foreground pb-2 mb-4">
        <h2 className="text-xl font-extrabold tracking-tight">📊 CONSOLIDADO GERAL</h2>
        <span className="text-xs uppercase tracking-widest font-semibold bg-foreground text-background px-2 py-1 rounded no-print">
          Prioridade
        </span>
      </div>
      <div className="section-grid grid grid-cols-1 md:grid-cols-2 gap-x-6">
        {sections.map((s, i) => (
          <SectionBlock key={i} section={s} />
        ))}
      </div>
    </div>
  );
}

export function DayBlock({ day }: { day: DaySheet }) {
  return (
    <div className="avoid-break day-card border border-foreground/40 rounded-lg p-4 mb-4 bg-card">
      <h2 className="text-lg font-bold mb-3 flex items-center gap-2 border-b border-foreground/30 pb-2">
        <span>📅</span>
        <span>{day.date}</span>
      </h2>
      <div className="section-grid grid grid-cols-1 gap-x-6">
        {day.sections.map((s, i) => (
          <SectionBlock key={i} section={s} />
        ))}
      </div>
    </div>
  );
}

export function DaysGrid({ children }: { children: React.ReactNode }) {
  return <div className="day-grid grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>;
}

