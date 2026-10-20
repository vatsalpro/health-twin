import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { LoginView } from '../views/LoginView';
import { MaternalTwin3D } from '../components/MaternalTwin3D';

describe('PregTwin Frontend Test Suite', () => {
  it('renders LoginView with branding and demo profile options', () => {
    render(
      <AuthProvider>
        <BrowserRouter>
          <LoginView />
        </BrowserRouter>
      </AuthProvider>
    );

    expect(screen.getByText('PregTwin')).toBeDefined();
    expect(screen.getByText('Dr. Elena Vance')).toBeDefined();
    expect(screen.getByText('Maya Lin (31.4w)')).toBeDefined();
    expect(screen.getByPlaceholderText('clinician@hospital.org')).toBeDefined();
  });

  it('renders MaternalTwin3D without crashing and handles WebGL gracefully', () => {
    const { container } = render(
      <MaternalTwin3D
        gestationalAgeWeeks={31.4}
        sbp={142}
        dbp={92}
        riskCategory="HIGH"
        interactive={false}
      />
    );

    expect(container).toBeDefined();
  });
});
