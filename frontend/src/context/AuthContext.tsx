import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, User, PatientProfile } from '../api/client';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  selectedPatientId: string | null;
  selectedPatient: PatientProfile | null;
  allPatients: PatientProfile[];
  login: (email: string, pass: string) => Promise<void>;
  logout: () => void;
  setSelectedPatientId: (id: string) => void;
  refreshPatientData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('pregtwin_token'));
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedPatientId, setSelectedPatientIdState] = useState<string | null>(
    localStorage.getItem('pregtwin_patient_id')
  );
  const [selectedPatient, setSelectedPatient] = useState<PatientProfile | null>(null);
  const [allPatients, setAllPatients] = useState<PatientProfile[]>([]);

  const setSelectedPatientId = (id: string) => {
    setSelectedPatientIdState(id);
    localStorage.setItem('pregtwin_patient_id', id);
    const cached = allPatients.find((p) => p.id === id);
    if (cached) {
      setSelectedPatient(cached);
    }
  };

  const refreshPatientData = async () => {
    if (!token) return;
    try {
      const patients = await api.listPatients();
      setAllPatients(patients);

      // Auto-select patient
      let targetId = selectedPatientId;
      if (!targetId || !patients.some((p) => p.id === targetId)) {
        if (user?.patient_id) {
          targetId = user.patient_id;
        } else if (patients.length > 0) {
          targetId = patients[0].id;
        }
      }

      if (targetId) {
        setSelectedPatientId(targetId);
        const pDetail = await api.getPatient(targetId);
        setSelectedPatient(pDetail);
      }
    } catch (err) {
      console.error('Failed to load patient records:', err);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        try {
          const me = await api.getMe();
          setUser(me);
          const patients = await api.listPatients();
          setAllPatients(patients);

          let targetId = selectedPatientId;
          if (!targetId || !patients.some((p) => p.id === targetId)) {
            if (me.patient_id) {
              targetId = me.patient_id;
            } else if (patients.length > 0) {
              targetId = patients[0].id;
            }
          }
          if (targetId) {
            setSelectedPatientId(targetId);
            const pDetail = await api.getPatient(targetId);
            setSelectedPatient(pDetail);
          }
        } catch {
          logout();
        }
      }
      setLoading(false);
    };
    initAuth();
  }, [token]);

  useEffect(() => {
    if (selectedPatientId && token) {
      api.getPatient(selectedPatientId)
        .then(setSelectedPatient)
        .catch((e) => console.error('Error fetching patient profile:', e));
    }
  }, [selectedPatientId]);

  const login = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const res = await api.login({ email, password: pass });
      localStorage.setItem('pregtwin_token', res.access_token);
      setToken(res.access_token);
      const me: User = {
        id: res.user_id,
        email: res.email,
        full_name: res.full_name,
        role: res.role,
        is_active: true,
        patient_id: res.patient_id,
      };
      setUser(me);
      if (res.patient_id) {
        setSelectedPatientId(res.patient_id);
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('pregtwin_token');
    localStorage.removeItem('pregtwin_patient_id');
    setToken(null);
    setUser(null);
    setSelectedPatient(null);
    setSelectedPatientIdState(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        selectedPatientId,
        selectedPatient,
        allPatients,
        login,
        logout,
        setSelectedPatientId,
        refreshPatientData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
