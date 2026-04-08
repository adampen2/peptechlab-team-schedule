import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar, Users, Building, Home, Palmtree, Clock,
  ChevronRight, X, ChevronLeft, Activity, Settings,
  Copy, Check, Trash2, BarChart
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  onSnapshot,
  deleteDoc,
  query,
  where,
  getDocs
} from 'firebase/firestore';

const firebaseConfig = JSON.parse(
  typeof __firebase_config !== 'undefined' ? __firebase_config : '{}'
);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

const ADMIN_EMAILS = [
  'maciej.rogowski@peptechlab.com',
  'adam.penkala@peptechlab.com'
];

const getNext30Days = () => {
  const dates = [];
  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
};

const formatDateDisplay = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('pl-PL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
};

const isToday = (dateString) => {
  const today = new Date().toISOString().split('T')[0];
  return dateString === today;
};

const formatMonthDisplay = (yyyyMM) => {
  const [year, month] = yyyyMM.split('-');
  const date = new Date(year, parseInt(month, 10) - 1, 1);
  return date.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
};

const calculateHours = (start, end) => {
  if (!start || !end) return 0;
  const [sH, sM] = start.split(':').map(Number);
  const [eH, eM] = end.split(':').map(Number);
  const diff = (eH + eM / 60) - (sH + sM / 60);
  return diff > 0 ? Math.round(diff * 10) / 10 : 0;
};

const getSmartDefaultDate = () => {
  const now = new Date();
  const targetDate = new Date(now);
  if (now.getHours() >= 16) {
    targetDate.setDate(targetDate.getDate() + 1);
  }
  return targetDate.toISOString().split('T')[0];
};

export default function App() {
  const [user, setUser] = useState(null);
  const [appUser, setAppUser] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('mine');

  const isAdmin =
    appUser && ADMIN_EMAILS.includes((appUser.email || '').toLowerCase());

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error('Auth error:', error);
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        setAppUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
        });
      } else {
        setAppUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Ładowanie...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-4">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">PepTechLab Team Schedule</h1>
        <p className="text-gray-600">Aplikacja harmonogramu zespołu.</p>
      </div>
    </div>
  );
}
