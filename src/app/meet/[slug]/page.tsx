"use client";

import { CalendarCheck, Clock } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { call } from "@/components/data";
import { Logo } from "@/components/logo";
import { Button, Field, cx, inputCls } from "@/components/ui";

interface Info {
  host: string;
  title: string;
  duration: number;
  timezone: string;
  days: { date: string; slots: string[] }[];
}

const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const fullLabel = (iso: string) => new Date(iso).toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });

/* The public scheduling page. Visitors are not signed in. Times are shown in
   the visitor's own time zone; the server re-checks that the slot is free. */
export default function BookingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [info, setInfo] = useState<Info | null>(null);
  const [missing, setMissing] = useState(false);
  const [day, setDay] = useState(0);
  const [slot, setSlot] = useState("");
  const [form, setForm] = useState({ name: "", email: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ start: string; ics: string } | null>(null);

  const load = () =>
    call<Info>(`public/booking/${slug}`)
      .then(setInfo)
      .catch(() => setMissing(true));

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const book = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      setDone(await call<{ start: string; ics: string }>(`public/booking/${slug}`, { start: slot, ...form }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSlot("");
      void load();
    } finally {
      setBusy(false);
    }
  };

  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="flex min-h-screen items-start justify-center px-4 py-10">
      <div className="w-full max-w-2xl rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6">
          <Logo />
        </div>
        {missing && <p className="text-sm text-stone-600">This scheduling page is not available.</p>}
        {!info && !missing && <p className="text-sm text-stone-500">Loading…</p>}

        {info && done && (
          <div className="text-center" role="status">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CalendarCheck size={24} />
            </span>
            <h1 className="mt-4 text-xl font-semibold tracking-tight text-stone-900">You are booked with {info.host}</h1>
            <p className="mt-1 text-sm text-stone-600">
              {info.title} · {fullLabel(done.start)}
            </p>
            <p className="mt-1 text-xs text-stone-500">A confirmation is on its way to {form.email}.</p>
            <a href={done.ics} className="mt-5 inline-flex rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700">
              Add to calendar
            </a>
          </div>
        )}

        {info && !done && (
          <>
            <h1 className="text-xl font-semibold tracking-tight text-stone-900">
              {info.title} with {info.host}
            </h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-stone-600">
              <Clock size={14} />
              {info.duration} minutes · times shown in {zone}
            </p>

            {info.days.length === 0 ? (
              <p className="mt-6 text-sm text-stone-600">There are no open times in the next two weeks.</p>
            ) : slot ? (
              <form className="mt-6 space-y-4" onSubmit={book}>
                <p className="rounded-lg bg-stone-100 px-3 py-2 text-sm font-medium text-stone-900">{fullLabel(slot)}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Your name">
                    <input required autoFocus className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </Field>
                  <Field label="Email">
                    <input required type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </Field>
                </div>
                <Field label="Anything we should know? (optional)">
                  <textarea rows={3} className={inputCls} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </Field>
                <div className="flex gap-2">
                  <Button type="submit" variant="primary" disabled={busy}>
                    {busy ? "Booking…" : "Confirm booking"}
                  </Button>
                  <Button onClick={() => setSlot("")}>Pick another time</Button>
                </div>
              </form>
            ) : (
              <div className="mt-6">
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {info.days.map((d, i) => (
                    <button key={d.date} type="button" onClick={() => setDay(i)} className={cx("shrink-0 rounded-xl border px-3 py-2 text-sm font-medium", day === i ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 text-stone-700 hover:bg-stone-50")}>
                      {dayLabel(d.slots[0])}
                    </button>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {(info.days[day] ?? info.days[0]).slots.map((s) => (
                    <button key={s} type="button" onClick={() => setSlot(s)} className="rounded-lg border border-stone-300 px-2 py-2 text-sm font-medium text-stone-800 hover:border-teal-600 hover:bg-teal-50">
                      {timeLabel(s)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {error && (
              <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900">
                {error}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
