"use client";

import { useActionState, useState } from "react";
import { bookAppointmentAction, type ActionState } from "@/lib/actions";

const initial: ActionState = { ok: false, message: "" };
const SLOTS = ["09:00", "10:30", "12:00", "14:00", "15:30", "17:00"];
const SERVICES = ["Styling session", "Fitting", "Bridal consultation", "Made-to-measure"];

export function AppointmentForm({ takenSlots }: { takenSlots: string[] }) {
  const [state, action, pending] = useActionState(bookAppointmentAction, initial);
  const today = new Date();
  const min = today.toISOString().slice(0, 10);
  const [date, setDate] = useState(min);
  const [time, setTime] = useState("");

  return (
    <form action={action} className="card space-y-5 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">Your name</label>
          <input id="name" name="name" required className="field" />
        </div>
        <div>
          <label className="label" htmlFor="contact">Phone or email</label>
          <input id="contact" name="contact" required className="field" />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="service">What would you like?</label>
        <select id="service" name="service" className="field">
          {SERVICES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="date">Preferred date</label>
        <input
          id="date" name="date" type="date" min={min} value={date}
          onChange={(e) => setDate(e.target.value)} required className="field"
        />
      </div>

      <div>
        <p className="label">Preferred time</p>
        <div className="flex flex-wrap gap-2">
          {SLOTS.map((slot) => {
            const taken = takenSlots.includes(`${date}T${slot}`);
            return (
              <button
                key={slot}
                type="button"
                disabled={taken}
                onClick={() => setTime(slot)}
                className={`chip ${time === slot ? "chip-active" : ""} ${taken ? "opacity-40 line-through" : ""}`}
              >
                {slot}
              </button>
            );
          })}
        </div>
        <input type="hidden" name="time" value={time} />
      </div>

      <div>
        <label className="label" htmlFor="notes">Anything we should know? (optional)</label>
        <textarea id="notes" name="notes" rows={3} className="field" placeholder="The occasion, a piece you have seen, sizing concerns…" />
      </div>

      <button className="btn btn-primary w-full" disabled={pending || !time}>
        {pending ? "Requesting…" : "Request this appointment"}
      </button>
      {state.message ? (
        <p className={`text-sm ${state.ok ? "text-accent" : "text-red-600"}`}>{state.message}</p>
      ) : null}
    </form>
  );
}
