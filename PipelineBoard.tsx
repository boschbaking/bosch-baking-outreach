"use client";

import { useState } from "react";
import Link from "next/link";
import {
  DndContext,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { PIPELINE_STAGES, type ProspectStatus } from "@/lib/types";
import { STATUS_COLORS } from "@/lib/status-colors";

interface PipelineProspect {
  id: string;
  business_name: string;
  city: string | null;
  business_type: string | null;
  status: ProspectStatus;
  prospect_score: number | null;
  do_not_contact: boolean;
}

export default function PipelineBoard({
  initialProspects,
}: {
  initialProspects: PipelineProspect[];
}) {
  const [prospects, setProspects] = useState(initialProspects);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const prospectId = String(active.id);
    const newStatus = String(over.id) as ProspectStatus;
    const current = prospects.find((p) => p.id === prospectId);
    if (!current || current.status === newStatus) return;

    setProspects((prev) =>
      prev.map((p) => (p.id === prospectId ? { ...p, status: newStatus } : p))
    );
    setPending((prev) => new Set(prev).add(prospectId));

    try {
      const res = await fetch(`/api/prospects/${prospectId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
    } catch {
      setProspects((prev) =>
        prev.map((p) => (p.id === prospectId ? { ...p, status: current.status } : p))
      );
    } finally {
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(prospectId);
        return next;
      });
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="mt-6 flex gap-3 overflow-x-auto pb-4 scrollbar-thin">
        {PIPELINE_STAGES.map((stage) => (
          <Column
            key={stage}
            stage={stage}
            prospects={prospects.filter((p) => p.status === stage)}
            pending={pending}
          />
        ))}
      </div>
    </DndContext>
  );
}

function Column({
  stage,
  prospects,
  pending,
}: {
  stage: ProspectStatus;
  prospects: PipelineProspect[];
  pending: Set<string>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div
      ref={setNodeRef}
      className={`w-64 shrink-0 rounded-md border ${
        isOver ? "border-[#c9a95a] bg-[#fbf7ee]" : "border-neutral-200 bg-neutral-50"
      } flex flex-col`}
    >
      <div className="px-3 py-2.5 border-b border-neutral-200 flex items-center justify-between">
        <span className="text-xs font-semibold text-[#001630] uppercase tracking-wide">
          {stage}
        </span>
        <span className="text-xs text-neutral-400">{prospects.length}</span>
      </div>
      <div className="p-2 space-y-2 flex-1 min-h-[120px] max-h-[70vh] overflow-y-auto scrollbar-thin">
        {prospects.map((p) => (
          <Card key={p.id} prospect={p} pending={pending.has(p.id)} />
        ))}
      </div>
    </div>
  );
}

function Card({ prospect, pending }: { prospect: PipelineProspect; pending: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: prospect.id,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`rounded border bg-white p-2.5 text-xs shadow-sm cursor-grab active:cursor-grabbing ${
        isDragging ? "opacity-50 z-10 relative" : ""
      } ${pending ? "opacity-60" : ""} ${STATUS_COLORS[prospect.status].split(" ")[2] ?? "border-neutral-200"}`}
    >
      <Link
        href={`/prospects/${prospect.id}`}
        onClick={(e) => e.stopPropagation()}
        className="font-medium text-[#001630] hover:text-[#c9a95a]"
      >
        {prospect.business_name}
      </Link>
      <div className="text-neutral-400 mt-0.5">
        {prospect.city ?? "—"}
        {prospect.business_type ? ` · ${prospect.business_type}` : ""}
      </div>
      {prospect.prospect_score != null && (
        <div className="text-neutral-400 mt-0.5">Score: {prospect.prospect_score}</div>
      )}
    </div>
  );
}
