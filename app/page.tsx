"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type EventType = "analyse" | "adrenaline" | "amiodarone" | "choc" | "rosc" | "deces" | "note";
type Phase = "idle" | "cycle" | "analyse";
type AcrDelay = "superieur10" | "inferieur10" | "temoin" | null;

type LogEvent = {
  id: string;
  type: EventType;
  label: string;
  timestamp: string;
  elapsedSec: number;
  notes?: string;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatDateTimeLocal(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatClock(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatFull(date: Date) {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${formatClock(date)}`;
}

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${pad(mins)}:${pad(secs)}`;
}

function getCycleNumber(elapsedSeconds: number) {
  return Math.floor(elapsedSeconds / 120) + 1;
}

function iconColor(type: EventType) {
  if (type === "choc") return "text-orange-500";
  if (type === "adrenaline") return "text-red-500";
  if (type === "amiodarone") return "text-violet-500";
  if (type === "analyse") return "text-blue-500";
  if (type === "rosc") return "text-green-500";
  if (type === "deces") return "text-gray-800";
  return "text-slate-600";
}

function badgeColor(type: EventType) {
  if (type === "choc") return "bg-orange-50 text-orange-700 border-orange-200";
  if (type === "adrenaline") return "bg-red-50 text-red-700 border-red-200";
  if (type === "amiodarone") return "bg-violet-50 text-violet-700 border-violet-200";
  if (type === "analyse") return "bg-blue-50 text-blue-700 border-blue-200";
  if (type === "rosc") return "bg-green-50 text-green-700 border-green-200";
  if (type === "deces") return "bg-gray-100 text-gray-800 border-gray-300";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function DotIcon({ className = "" }: { className?: string }) {
  return <span className={`inline-block h-3 w-3 rounded-full bg-current ${className}`} />;
}

function PrimaryButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }
) {
  const { className = "", active = false, ...rest } = props;
  return (
    <button
      {...rest}
      className={[
        "rounded-2xl px-4 py-4 text-left font-semibold shadow-sm transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed",
        active ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-900",
        className,
      ].join(" ")}
    />
  );
}

export default function Page() {
  const [now, setNow] = useState(new Date());
  const [lowFlowTime, setLowFlowTime] = useState(formatDateTimeLocal(new Date()));
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [note, setNote] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [cycleNumber, setCycleNumber] = useState(1);
  const [acrDelay, setAcrDelay] = useState<AcrDelay>(null);
  const [lastTransitionSecond, setLastTransitionSecond] = useState<number | null>(null);
  const audioCtxRef = useRef<any>(null);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isRunning) return;
    const interval = window.setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isRunning]);

  const addLog = (type: EventType, label: string, notes?: string, elapsedOverride?: number) => {
    const item: LogEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      label,
      timestamp: formatFull(new Date()),
      elapsedSec: elapsedOverride ?? elapsedSec,
      notes,
    };
    setLogs((prev) => [item, ...prev]);
  };

  const playAlarm = () => {
    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate([250, 120, 250]);
      }

      const AudioContextClass =
        (window as any).AudioContext || (window as any).webkitAudioContext || null;

      if (!AudioContextClass) {
        window.alert(`Fin du cycle ${cycleNumber} : analyse ${cycleNumber} en cours.`);
        return;
      }

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContextClass();
      }

      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume?.();
      }

      const startAt = ctx.currentTime + 0.02;
      [880, 660, 880].forEach((freq: number, index: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, startAt + index * 0.22);
        gain.gain.setValueAtTime(0.0001, startAt + index * 0.22);
        gain.gain.exponentialRampToValueAtTime(0.12, startAt + index * 0.22 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + index * 0.22 + 0.16);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startAt + index * 0.22);
        osc.stop(startAt + index * 0.22 + 0.18);
      });

      window.setTimeout(() => {
        window.alert(`Fin du cycle ${cycleNumber} : analyse ${cycleNumber} en cours.`);
      }, 120);
    } catch {
      window.alert(`Fin du cycle ${cycleNumber} : analyse ${cycleNumber} en cours.`);
    }
  };

  useEffect(() => {
    if (!isRunning || phase !== "cycle" || elapsedSec === 0) return;
    if (elapsedSec % 120 === 0 && lastTransitionSecond !== elapsedSec) {
      setLastTransitionSecond(elapsedSec);
      setIsRunning(false);
      setPhase("analyse");
      addLog("analyse", `Analyse ${cycleNumber} en cours`, undefined, elapsedSec);
      playAlarm();
    }
  }, [elapsedSec, isRunning, phase, cycleNumber, lastTransitionSecond]);

  const startAcr = () => {
    const lowFlowDate = new Date(lowFlowTime);
    const nowDate = new Date();
    const initial = Math.max(0, Math.floor((nowDate.getTime() - lowFlowDate.getTime()) / 1000));
    setElapsedSec(initial);
    setLogs([]);
    setCycleNumber(getCycleNumber(initial));
    setPhase("cycle");
    setIsRunning(true);
    setLastTransitionSecond(null);
    addLog("note", "Début du suivi Time Keeper - début du low flow", undefined, initial);
  };

  const launchNextCycle = () => {
    addLog("analyse", `Analyse ${cycleNumber} validée`);
    setCycleNumber((prev) => prev + 1);
    setPhase("cycle");
    setLastTransitionSecond(elapsedSec);
    setIsRunning(true);
  };

  const resetAll = () => {
    setIsRunning(false);
    setElapsedSec(0);
    setLogs([]);
    setNote("");
    setPhase("idle");
    setCycleNumber(1);
    setAcrDelay(null);
    setLastTransitionSecond(null);
    setLowFlowTime(formatDateTimeLocal(new Date()));
  };

const exportCsv = () => {
  const header = ["Type", "Libellé", "Horodatage", "Temps écoulé", "Notes"];
  const rows = logs
    .slice()
    .reverse()
    .map((log) => [
      log.type,
      log.label,
      log.timestamp,
      formatDuration(log.elapsedSec),
      log.notes || "",
    ]);

  const csv = [header, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `time_keeper_${new Date()
    .toISOString()
    .slice(0, 19)
    .replace(/[:T]/g, "-")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

  const selectAcrDelay = (value: AcrDelay) => {
    setAcrDelay(value);
    if (value === "superieur10") addLog("note", "ACR : supérieur à 10 min");
    if (value === "inferieur10") addLog("note", "ACR : inférieur à 10 min");
    if (value === "temoin") addLog("note", "ACR : devant témoin / maintenant");
  };

  const counts = useMemo(
    () => ({
      analyses: logs.filter((l) => l.type === "analyse").length,
      adrenaline: logs.filter((l) => l.type === "adrenaline").length,
      amiodarone: logs.filter((l) => l.type === "amiodarone").length,
      chocs: logs.filter((l) => l.type === "choc").length,
    }),
    [logs]
  );

  const nextAlarmSec = phase === "cycle" ? (120 - (elapsedSec % 120 || 120) === 120 ? 0 : 120 - (elapsedSec % 120)) : 0;
  const phaseLabel = phase === "idle" ? "Prêt à démarrer" : phase === "cycle" ? `Cycle ${cycleNumber} en cours` : `Analyse ${cycleNumber} en cours`;
  const acrDelayLabel =
    acrDelay === "superieur10"
      ? "Supérieur à 10 min"
      : acrDelay === "inferieur10"
      ? "Inférieur à 10 min"
      : acrDelay === "temoin"
      ? "Devant témoin / maintenant"
      : "Non renseigné";

  const actionButtons = [
    { type: "adrenaline" as EventType, label: "Adrénaline", sub: "Horodater l’administration" },
    { type: "amiodarone" as EventType, label: "Amiodarone", sub: "Horodater l’administration" },
    { type: "choc" as EventType, label: "Choc électrique", sub: "Horodater le choc" },
    { type: "analyse" as EventType, label: "Analyse du rythme", sub: "Horodater l’analyse" },
    { type: "rosc" as EventType, label: "ROSC", sub: "Retour circulation spontanée" },
    { type: "deces" as EventType, label: "Décès", sub: "Horodater la constatation" },
  ];

  return (
    <main className="min-h-screen bg-slate-100 p-3 text-slate-900">
      <div className="mx-auto max-w-md space-y-4">
        <section className="rounded-3xl bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">Time Keeper ACR</h1>
              <p className="mt-1 text-sm text-slate-600">Version smartphone pour réanimation.</p>
            </div>
            <div className="rounded-2xl bg-slate-100 px-3 py-2 text-right">
              <div className="text-xs uppercase tracking-wide text-slate-500">Heure actuelle</div>
              <div className="text-lg font-semibold tabular-nums">{formatClock(now)}</div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">Informations</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium">{phaseLabel}</span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Début du low flow</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{formatClock(new Date(lowFlowTime))}</div>
            <div className="text-xs text-slate-500">{formatFull(new Date(lowFlowTime))}</div>
            <div className="mt-2 text-xs text-slate-500">ACR : {acrDelayLabel}</div>
          </div>

          <div className="mt-4 space-y-3">
            <label className="block text-sm font-medium">Heure de début du low flow</label>
            <input
              type="datetime-local"
              value={lowFlowTime}
              onChange={(e) => setLowFlowTime(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-slate-500"
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border bg-slate-50 p-4">
              <div className="text-xs text-slate-500">Temps écoulé</div>
              <div className="mt-1 text-3xl font-bold tabular-nums">{formatDuration(elapsedSec)}</div>
            </div>
            <div className="rounded-2xl border bg-slate-50 p-4">
              <div className="text-xs text-slate-500">Prochaine étape</div>
              <div className="mt-1 text-sm font-semibold">{phaseLabel}</div>
              <div className="mt-2 text-xs text-slate-500">
                {phase === "cycle" ? `Fin du cycle dans ${formatDuration(nextAlarmSec)}` : phase === "analyse" ? "Appuyer pour relancer le cycle suivant" : ""}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 text-sm font-semibold">ACR</div>
            <div className="grid gap-2">
              <PrimaryButton active={acrDelay === "superieur10"} onClick={() => selectAcrDelay("superieur10")}>Supérieur à 10 min</PrimaryButton>
              <PrimaryButton active={acrDelay === "inferieur10"} onClick={() => selectAcrDelay("inferieur10")}>Inférieur à 10 min</PrimaryButton>
              <PrimaryButton active={acrDelay === "temoin"} onClick={() => selectAcrDelay("temoin")}>Devant témoin / maintenant</PrimaryButton>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            {!isRunning && elapsedSec === 0 && (
              <button onClick={startAcr} className="flex-1 rounded-2xl bg-slate-900 px-4 py-4 font-semibold text-white">
                Démarrer ACR
              </button>
            )}
            {isRunning && phase === "cycle" && (
              <button onClick={() => setIsRunning(false)} className="flex-1 rounded-2xl bg-slate-700 px-4 py-4 font-semibold text-white">
                Pause
              </button>
            )}
            {!isRunning && elapsedSec > 0 && phase === "cycle" && (
              <button onClick={() => setIsRunning(true)} className="flex-1 rounded-2xl bg-slate-900 px-4 py-4 font-semibold text-white">
                Reprendre
              </button>
            )}
            {phase === "analyse" && (
              <button onClick={launchNextCycle} className="flex-1 rounded-2xl bg-blue-600 px-4 py-4 font-semibold text-white">
                Analyse {cycleNumber} en cours
              </button>
            )}
            <button onClick={resetAll} className="rounded-2xl border border-slate-300 bg-white px-4 py-4 font-semibold">
              Réinitialiser
            </button>
            <button onClick={exportCsv} className="rounded-2xl border border-slate-300 bg-white px-4 py-4 font-semibold">
              Export CSV
            </button>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-bold">Actions rapides</h2>
          <div className="grid gap-3">
            {actionButtons.map((action) => (
              <button
                key={action.type}
                onClick={() => {
                  const label = action.type === "analyse" ? "Analyse de rythme réalisée" : action.label;
                  addLog(action.type, label);
                }}
                className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <DotIcon className={iconColor(action.type)} />
                  <div>
                    <div className="font-semibold">{action.label}</div>
                    <div className="text-sm text-slate-500">{action.sub}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-3xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-bold">Note libre</h2>
          <div className="space-y-3">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex. intubation réalisée, capno, changement d’opérateur..."
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-slate-500"
            />
            <button
              onClick={() => {
                if (!note.trim()) return;
                addLog("note", "Note libre", note.trim());
                setNote("");
              }}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 font-semibold"
            >
              Ajouter la note
            </button>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-bold">Synthèse</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border bg-slate-50 p-4"><div className="text-xs text-slate-500">Analyses</div><div className="text-2xl font-bold">{counts.analyses}</div></div>
            <div className="rounded-2xl border bg-slate-50 p-4"><div className="text-xs text-slate-500">Adrénaline</div><div className="text-2xl font-bold">{counts.adrenaline}</div></div>
            <div className="rounded-2xl border bg-slate-50 p-4"><div className="text-xs text-slate-500">Amiodarone</div><div className="text-2xl font-bold">{counts.amiodarone}</div></div>
            <div className="rounded-2xl border bg-slate-50 p-4"><div className="text-xs text-slate-500">Chocs</div><div className="text-2xl font-bold">{counts.chocs}</div></div>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-bold">Journal horodaté</h2>
          <div className="space-y-3">
            {logs.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-slate-500">
                Aucun événement enregistré.
              </div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="rounded-2xl border bg-white p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${badgeColor(log.type)}`}>
                      {log.label}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium tabular-nums">
                      T+ {formatDuration(log.elapsedSec)}
                    </span>
                  </div>
                  <div className="text-sm font-medium">{log.timestamp}</div>
                  {log.notes && <div className="mt-2 text-sm text-slate-600">{log.notes}</div>}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

