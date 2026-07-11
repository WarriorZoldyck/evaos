import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type HeaderSlotContextValue = {
  content: ReactNode;
  setContent: (node: ReactNode) => void;
};

const HeaderSlotContext = createContext<HeaderSlotContextValue | null>(null);

export function HeaderSlotProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<ReactNode>(null);
  return (
    <HeaderSlotContext.Provider value={{ content, setContent }}>
      {children}
    </HeaderSlotContext.Provider>
  );
}

export function useHeaderSlotContent() {
  const ctx = useContext(HeaderSlotContext);
  return ctx?.content ?? null;
}

/**
 * Inject content into the global app header center slot.
 * Content is cleared automatically when the calling component unmounts.
 */
export function useHeaderSlot(node: ReactNode) {
  const ctx = useContext(HeaderSlotContext);
  useEffect(() => {
    if (!ctx) return;
    ctx.setContent(node);
    return () => ctx.setContent(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node]);
}
