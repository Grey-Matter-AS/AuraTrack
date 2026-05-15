import { useState } from 'react';
import { db } from '../data/db';

export function useEventHistory() {
  const [history, setHistory] = useState([]);

  const load = async () => {
    try {
      const events = await db.events.orderBy('startTime').reverse().limit(5).toArray();
      setHistory(events);
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  const loadAll = async () => {
    try {
      return await db.events.orderBy('startTime').reverse().toArray();
    } catch (err) {
      console.error('Failed to load all events:', err);
      return [];
    }
  };

  const deleteEvent = async (id) => {
    try {
      await db.events.delete(id);
    } catch (err) {
      console.error('Failed to delete event:', err);
      throw err;
    }
  };

  return { history, load, loadAll, deleteEvent };
}
