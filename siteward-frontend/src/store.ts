import create from 'zustand';

interface Website {
  id: string;
  url: string;
  name: string;
  health_score: number;
  status: 'healthy' | 'warning' | 'critical';
  last_scan: string;
}

interface AppState {
  websites: Website[];
  selectedWebsite: Website | null;
  loading: boolean;
  setWebsites: (websites: Website[]) => void;
  setSelectedWebsite: (website: Website | null) => void;
  setLoading: (loading: boolean) => void;
  addWebsite: (website: Website) => void;
}

export const useAppStore = create<AppState>((set) => ({
  websites: [],
  selectedWebsite: null,
  loading: false,
  setWebsites: (websites) => set({ websites }),
  setSelectedWebsite: (selectedWebsite) => set({ selectedWebsite }),
  setLoading: (loading) => set({ loading }),
  addWebsite: (website) => set((state) => ({ 
    websites: [...state.websites, website] 
  })),
}));
