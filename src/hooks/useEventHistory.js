import { useState } from 'react';
import { db } from '../data/db';

export function useEventHistory() {
  const [history, setHistory] = useState([]);

  const load = async () => {
    const events = await db.events.orderBy('startTime').reverse().limit(5).toArray();
    setHistory(events);
  };

  const loadAll = async () => {
    return db.events.orderBy('startTime').reverse().toArray();
  };

  const deleteEvent = async (id) => {
    await db.events.delete(id);
  };

  return { history, load, loadAll, deleteEvent };
}
