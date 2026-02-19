import { useState, useCallback } from 'react';

type MemoryCategory = 'personal' | 'preference' | 'interest' | 'context';

type Memory = {
  id: string;
  content: string;
  category: MemoryCategory;
  source_chat_id: string | null;
  created_at: string;
  updated_at: string;
};

export function useMemories() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [plan, setPlan] = useState<string | null>(null);

  const fetchMemories = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/memories');
      if (!res.ok) return;
      const data = await res.json();
      setMemories(data.memories || []);
      setPlan(data.plan || null);
    } catch (error) {
      console.error('Failed to fetch memories:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteMemory = useCallback(async (memoryId: string) => {
    // Optimistic update
    const prev = [...memories];
    setMemories((m) => m.filter((mem) => mem.id !== memoryId));

    try {
      const res = await fetch(`/api/memories?id=${memoryId}`, { method: 'DELETE' });
      if (!res.ok) {
        setMemories(prev); // Revert on failure
      }
    } catch {
      setMemories(prev);
    }
  }, [memories]);

  const clearAll = useCallback(async () => {
    const prev = [...memories];
    setMemories([]);

    try {
      const res = await fetch('/api/memories/clear', { method: 'POST' });
      if (!res.ok) {
        setMemories(prev);
      }
    } catch {
      setMemories(prev);
    }
  }, [memories]);

  return {
    memories,
    isLoading,
    plan,
    fetchMemories,
    deleteMemory,
    clearAll,
  };
}
