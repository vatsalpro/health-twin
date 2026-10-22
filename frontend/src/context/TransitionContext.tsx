import React, { createContext, useContext, useState, useCallback } from 'react';

interface TransitionContextType {
  isTransitioning: boolean;
  triggerAppTransition: (onMidpointNavigate: () => void) => void;
  endTransition: () => void;
  onMidpointAction: (() => void) | null;
}

const TransitionContext = createContext<TransitionContextType | undefined>(undefined);

export const TransitionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [onMidpointAction, setOnMidpointAction] = useState<(() => void) | null>(null);

  const triggerAppTransition = useCallback((onMidpointNavigate: () => void) => {
    setOnMidpointAction(() => onMidpointNavigate);
    setIsTransitioning(true);
  }, []);

  const endTransition = useCallback(() => {
    setIsTransitioning(false);
    setOnMidpointAction(null);
  }, []);

  return (
    <TransitionContext.Provider
      value={{
        isTransitioning,
        triggerAppTransition,
        endTransition,
        onMidpointAction,
      }}
    >
      {children}
    </TransitionContext.Provider>
  );
};

const defaultTransitionContext: TransitionContextType = {
  isTransitioning: false,
  triggerAppTransition: (onMidpointNavigate: () => void) => {
    onMidpointNavigate();
  },
  endTransition: () => {},
  onMidpointAction: null,
};

export const useAppTransition = () => {
  const context = useContext(TransitionContext);
  if (!context) {
    return defaultTransitionContext;
  }
  return context;
};
