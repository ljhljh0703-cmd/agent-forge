import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface RunMeta {
  runId: string;
  idea: string;
  createdAt: string;
  gddText: string;
  templateApiCheck: {
    status: 'in_scope' | 'downscoped' | 'flagged';
    inScope: string[];
    flagged: string[];
  };
  reachabilityProof: {
    pass: boolean;
    playerMoves: boolean;
    scoreChanges: boolean;
    winReachable: boolean;
    failReachable: boolean;
    terminalReachable: boolean;
    flagged: string[];
  };
  usedTemplates: Array<{
    id: string;
    description: string;
    stabilityAtUse: number;
    statusAtUse: string;
    sourceRuns: string[];
  }>;
  proof: {
    usesCanvas: boolean;
    usesGeneratedAsset: boolean;
    usesDrawImage: boolean;
    snapshotCaptured: boolean;
  };
  outputs: {
    game?: string;
    sprite?: string;
    snapshot?: string;
    gdd?: string;
    rawAsset?: string;
    atlas?: string;
  };
  evolution?: {
    templateExtracted?: {
      id: string;
      description: string;
      stability: number;
      status: string;
    };
  };
}

export interface Template {
  id: string;
  description: string;
  contract: Record<string, unknown>;
  sourceRuns: string[];
  stability: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface RuleCandidate {
  id: string;
  errorSignature: string;
  occurrences: number;
  proposedRule: string;
  checkTiming: string;
  status: string;
  active: boolean;
  requiresHitl: boolean;
  createdAt: string;
  updatedAt: string;
  activationNote?: string;
}

export interface StudioMemory {
  templates: { templates: Template[]; stableThresholdProjects: number };
  ruleCandidates: { candidates: RuleCandidate[] };
}

interface MonitorContextValue {
  runs: RunMeta[];
  memory: StudioMemory | null;
  loading: boolean;
  selectedRunId: string | null;
  setSelectedRunId: (id: string | null) => void;
  refresh: () => void;
}

const MonitorContext = createContext<MonitorContextValue>({
  runs: [], memory: null, loading: false,
  selectedRunId: null, setSelectedRunId: () => {}, refresh: () => {},
});

export const MonitorContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [runs,          setRuns]          = useState<RunMeta[]>([]);
  const [memory,        setMemory]        = useState<StudioMemory | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/runs').then(r => r.json()).catch(() => []),
      fetch('/api/studio-memory').then(r => r.json()).catch(() => null),
    ]).then(([runsData, memData]) => {
      setRuns(Array.isArray(runsData) ? runsData : []);
      setMemory(memData ?? null);
      setLoading(false);
    });
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <MonitorContext.Provider value={{ runs, memory, loading, selectedRunId, setSelectedRunId, refresh }}>
      {children}
    </MonitorContext.Provider>
  );
};

export const useMonitor = () => useContext(MonitorContext);
