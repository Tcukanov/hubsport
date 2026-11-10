"use client";

import { Circle, Delete, Grid3x3, Mic, MicOff, Minus, Pause, Phone, PhoneOff, Play, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { CALL_OUTCOMES } from "@/lib/config";
import { displayName } from "@/lib/objects";
import { useData } from "./data";
import { Avatar, Button, cx, inputCls } from "./ui";

/* The calling window. No phone line is connected, so a call here is a
   practice call: the window goes through ringing and in-call screens and the
   result is logged on the timeline, but nobody's phone actually rings. */

interface Links {
  companyId?: string | null;
  dealId?: string | null;
  ticketId?: string | null;
}

interface Target {
  contactId?: string | null;
  links?: Links;
}

const CallCtx = createContext<{ open: (target?: Target) => void } | null>(null);

export function useCall() {
  const ctx = useContext(CallCtx);
  if (!ctx) throw new Error("useCall must be used inside CallProvider");
  return ctx;
}

type Stage = "dial" | "ringing" | "live" | "wrap";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function RoundButton({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className="flex flex-col items-center gap-1 text-xs text-white/80">
      <span className={cx("flex h-11 w-11 items-center justify-center rounded-full", active ? "bg-white text-stone-900" : "bg-white/15 text-white hover:bg-white/25")}>{children}</span>
      {label}
    </button>
  );
}

function Widget({ initial, onClose }: { initial: Target; onClose: () => void }) {
  const { db, log } = useData();
  const [stage, setStage] = useState<Stage>("dial");
  const [contactId, setContactId] = useState(initial.contactId ?? "");
  const [number, setNumber] = useState(() => db.contacts.find((c) => c.id === initial.contactId)?.phone ?? "");
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [held, setHeld] = useState(false);
  const [recording, setRecording] = useState(false);
  const [keypad, setKeypad] = useState(false);
  const [small, setSmall] = useState(false);
  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState(CALL_OUTCOMES[0]);

  const contact = db.contacts.find((c) => c.id === contactId);
  const company = db.companies.find((c) => c.id === contact?.companyId);
  const name = contact ? displayName("contacts", contact) : number || "Unknown number";

  // Ringing turns into a connected call after a moment; a connected call counts seconds.
  useEffect(() => {
    if (stage === "ringing") {
      const t = setTimeout(() => setStage("live"), 2600);
      return () => clearTimeout(t);
    }
    if (stage === "live" && !held) {
      const t = setInterval(() => setSeconds((s) => s + 1), 1000);
      return () => clearInterval(t);
    }
  }, [stage, held]);

  const hangUp = () => {
    setOutcome(stage === "live" ? "Connected" : "No answer");
    setStage("wrap");
    setSmall(false);
  };

  const save = () => {
    const lines = [notes.trim(), `Duration ${clock(seconds)} · practice call, no phone line connected`].filter(Boolean);
    log({ type: "call", subject: outcome, body: lines.join("\n\n"), contactId: contact?.id ?? null, companyId: contact?.companyId ?? initial.links?.companyId ?? null, dealId: initial.links?.dealId ?? null, ticketId: initial.links?.ticketId ?? null });
    onClose();
  };

  const frame = "fixed bottom-4 right-4 z-50 w-[320px] overflow-hidden rounded-2xl bg-[#2e2e2e] text-white shadow-2xl";

  if (small && (stage === "ringing" || stage === "live"))
    return (
      <div className={cx(frame, "flex items-center gap-3 px-4 py-3")} role="dialog" aria-label="Call in progress">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSmall(false)}>
          <span className="block truncate text-sm font-medium">{name}</span>
          <span className="block text-xs tabular-nums text-white/70">{stage === "ringing" ? "Ringing…" : clock(seconds)}</span>
        </button>
        <button type="button" aria-label="End call" onClick={hangUp} className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-600 hover:bg-rose-500">
          <PhoneOff size={16} />
        </button>
      </div>
    );

  return (
    <div className={frame} role="dialog" aria-label="Calling window">
      <header className="flex items-center justify-between px-4 py-3">
        <span className="text-sm font-semibold">{stage === "dial" ? "Make a call" : stage === "wrap" ? "Call ended" : stage === "ringing" ? "Calling…" : held ? "On hold" : "On call"}</span>
        <span className="flex gap-1">
          {(stage === "ringing" || stage === "live") && (
            <button type="button" aria-label="Minimise" onClick={() => setSmall(true)} className="rounded p-1 hover:bg-white/15">
              <Minus size={16} />
            </button>
          )}
          {(stage === "dial" || stage === "wrap") && (
            <button type="button" aria-label="Close" onClick={onClose} className="rounded p-1 hover:bg-white/15">
              <X size={16} />
            </button>
          )}
        </span>
      </header>

      {stage === "dial" && (
        <div className="space-y-3 px-4 pb-4">
          <select
            aria-label="Contact to call"
            className="w-full rounded-md border border-white/30 bg-transparent px-3 py-2 text-sm text-white outline-none focus:border-white"
            value={contactId}
            onChange={(e) => {
              setContactId(e.target.value);
              setNumber(db.contacts.find((c) => c.id === e.target.value)?.phone ?? "");
            }}
          >
            <option value="" className="text-stone-900">
              Choose a contact or dial a number
            </option>
            {db.contacts.map((c) => (
              <option key={c.id} value={c.id} className="text-stone-900">
                {displayName("contacts", c)}
                {c.phone ? ` · ${c.phone}` : " · no number"}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2 border-b border-white/30 pb-1">
            <input aria-label="Phone number" inputMode="tel" className="min-w-0 flex-1 bg-transparent py-1 text-center text-xl tabular-nums tracking-wide outline-none placeholder:text-white/40" placeholder="Enter a number" value={number} onChange={(e) => setNumber(e.target.value.replace(/[^\d+*#() -]/g, ""))} />
            <button type="button" aria-label="Delete last digit" onClick={() => setNumber((n) => n.slice(0, -1))} className="rounded p-1 text-white/70 hover:bg-white/15">
              <Delete size={18} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {KEYS.map((k) => (
              <button key={k} type="button" onClick={() => setNumber((n) => n + k)} className="rounded-xl bg-white/10 py-2.5 text-lg font-medium hover:bg-white/20">
                {k}
              </button>
            ))}
          </div>
          <button type="button" disabled={!number.trim()} onClick={() => setStage("ringing")} className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 py-2.5 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-40">
            <Phone size={16} />
            Call
          </button>
          <p className="text-center text-[11px] leading-snug text-white/60">Practice mode: no phone line is connected, so nobody is actually called. The call is still logged.</p>
        </div>
      )}

      {(stage === "ringing" || stage === "live") && (
        <div className="px-4 pb-5">
          <div className="flex flex-col items-center gap-1 py-3 text-center">
            <Avatar name={name} color="#0f766e" size={56} />
            <p className="mt-2 text-base font-semibold">{name}</p>
            {contact && <p className="text-xs text-white/70">{[contact.jobTitle, company?.name].filter(Boolean).join(" at ")}</p>}
            <p className="text-sm tabular-nums text-white/80">{number}</p>
            <p className={cx("mt-1 text-lg tabular-nums", stage === "ringing" && "animate-pulse")} aria-live="polite">
              {stage === "ringing" ? "Ringing…" : clock(seconds)}
            </p>
            {recording && stage === "live" && (
              <p className="flex items-center gap-1.5 text-xs text-rose-300">
                <Circle size={8} fill="currentColor" />
                Recording (practice: nothing is stored)
              </p>
            )}
          </div>
          {keypad ? (
            <div className="grid grid-cols-3 gap-2 pb-3">
              {KEYS.map((k) => (
                <button key={k} type="button" className="rounded-xl bg-white/10 py-2 text-base font-medium hover:bg-white/20">
                  {k}
                </button>
              ))}
            </div>
          ) : (
            <textarea aria-label="Call notes" rows={3} className="mb-3 w-full rounded-lg border border-white/25 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-white/50 focus:border-white" placeholder="Take notes during the call…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          )}
          <div className="flex items-start justify-between px-1">
            <RoundButton label={muted ? "Unmute" : "Mute"} active={muted} onClick={() => setMuted((v) => !v)}>
              {muted ? <MicOff size={18} /> : <Mic size={18} />}
            </RoundButton>
            <RoundButton label={held ? "Resume" : "Hold"} active={held} onClick={() => setHeld((v) => !v)}>
              {held ? <Play size={18} /> : <Pause size={18} />}
            </RoundButton>
            <RoundButton label="Keypad" active={keypad} onClick={() => setKeypad((v) => !v)}>
              <Grid3x3 size={18} />
            </RoundButton>
            <RoundButton label="Record" active={recording} onClick={() => setRecording((v) => !v)}>
              <Circle size={16} fill={recording ? "#e11d48" : "none"} />
            </RoundButton>
            <button type="button" onClick={hangUp} className="flex flex-col items-center gap-1 text-xs text-white/80">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-600 hover:bg-rose-500">
                <PhoneOff size={18} />
              </span>
              End
            </button>
          </div>
        </div>
      )}

      {stage === "wrap" && (
        <div className="space-y-3 bg-white px-4 py-4 text-stone-900">
          <p className="text-sm">
            <span className="font-semibold">{name}</span> · {clock(seconds)}
          </p>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-stone-600">Call outcome</span>
            <select className={inputCls} value={outcome} onChange={(e) => setOutcome(e.target.value)}>
              {CALL_OUTCOMES.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-stone-600">Notes</span>
            <textarea rows={4} className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <Button variant="primary" className="flex-1" onClick={save}>
              Save call
            </Button>
            <Button onClick={onClose}>Discard</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<{ key: number; target: Target } | null>(null);
  const open = useCallback((target: Target = {}) => setSession((s) => s ?? { key: Date.now(), target }), []);
  const value = useMemo(() => ({ open }), [open]);
  return (
    <CallCtx.Provider value={value}>
      {children}
      {session && <Widget key={session.key} initial={session.target} onClose={() => setSession(null)} />}
    </CallCtx.Provider>
  );
}
