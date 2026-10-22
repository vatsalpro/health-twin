import React from 'react';
import { FrontWelcomeView } from './FrontWelcomeView';

// Re-export FrontWelcomeView as LoginView so that /login renders the full front screen experience
export const LoginView: React.FC = () => {
  return <FrontWelcomeView />;
};

export default LoginView;
