import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Users, Building, Home, Palmtree, Clock, ChevronRight, X, ChevronLeft, Activity, Settings, Copy, Check, Trash2, BarChart } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, deleteDoc, query, where, getDocs } from 'firebase/firestore';

// --- INICJALIZACJA FIREBASE ---
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
      };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'peptechlab-app';

// --- ADRESY EMAIL ADMINISTRATORÓW ---
const ADMIN_EMAILS = [
  'maciej.rogowski@peptechlab.com',
  'adam.penkala@peptechlab.com'
];

// --- POMOCNICZE FUNKCJE DATY ---
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
  const options = { weekday: 'short', day: 'numeric', month: 'short' };
  return date.toLocaleDateString('pl-PL', options);
};

const isToday = (dateString) => {
  const today = new Date().toISOString().split('T')[0];
  return dateString === today;
};

const formatMonthDisplay = (yyyyMM) => {
  const [year, month] = yyyyMM.split('-');
  const date = new Date(year, parseInt(month) - 1, 1);
  return date.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
};

const calculateHours = (start, end) => {
  if (!start || !end) return 0;
  const [sH, sM] = start.split(':').map(Number);
  const [eH, eM] = end.split(':').map(Number);
  let diff = (eH + eM / 60) - (sH + sM / 60);
  return diff > 0 ? Math.round(diff * 10) / 10 : 0;
};

const getSmartDefaultDate = () => {
  const now = new Date();
  const hour = now.getHours();
  const targetDate = new Date(now);

  if (hour >= 16) {
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

  const isAdmin = appUser && ADMIN_EMAILS.includes(appUser.email.toLowerCase());

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error('Błąd autoryzacji:', err);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        const storedEmail = localStorage.getItem('peptech_email');

        if (storedEmail) {
          try {
            const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');
            const q = query(usersRef, where('email', '==', storedEmail.toLowerCase()));
            const snap = await getDocs(q);

            if (!snap.empty) {
              const existingUser = snap.docs[0];
              setAppUser({ id: existingUser.id, ...existingUser.data() });
            } else {
              setAppUser(null);
            }
          } catch (err) {
            console.error('Błąd pobierania użytkownika po emailu:', err);
            setAppUser(null);
          }
        } else {
          setAppUser(null);
        }
      } else {
        setAppUser(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const schedulesRef = collection(db, 'artifacts', appId, 'public', 'data', 'schedules');
    const unsubscribe = onSnapshot(
      schedulesRef,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setSchedules(data);
      },
      (error) => {
        console.error('Błąd pobierania grafików:', error);
      }
    );

    return () => unsubscribe();
  }, [user]);

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500">Ładowanie...</div>;
  }

  if (!appUser) {
    return <LoginScreen user={user} setAppUser={setAppUser} />;
  }

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-slate-50 shadow-xl overflow-hidden relative">
      <header className="bg-blue-600 text-white p-4 shadow-md z-10 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">PeptechLab Schedule</h1>
          <p className="text-sm text-blue-100 opacity-90">Zalogowano jako: {appUser.name}</p>
        </div>
        {isAdmin && (
          <span className="bg-blue-800 text-xs px-2 py-1 rounded text-blue-100 font-medium">ADMIN</span>
        )}
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        {activeTab === 'mine' ? (
          <MySchedule appUser={appUser} schedules={schedules} />
        ) : activeTab === 'team' ? (
          <TeamSchedule schedules={schedules} />
        ) : activeTab === 'reports' ? (
          <ReportsPanel schedules={schedules} />
        ) : (
          <AdminPanel />
        )}
      </main>

      <nav className="absolute bottom-0 w-full bg-white border-t border-slate-200 flex justify-around p-3 pb-safe z-20">
        <button
          onClick={() => setActiveTab('mine')}
          className={`flex flex-col items-center p-2 rounded-xl transition-colors ${activeTab === 'mine' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Calendar className="w-6 h-6 mb-1" />
          <span className="text-xs font-medium">Mój Grafik</span>
        </button>
        <button
          onClick={() => setActiveTab('team')}
          className={`flex flex-col items-center p-2 rounded-xl transition-colors ${activeTab === 'team' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Users className="w-6 h-6 mb-1" />
          <span className="text-xs font-medium">Zespół</span>
        </button>
        {isAdmin && (
          <>
            <button
              onClick={() => setActiveTab('reports')}
              className={`flex flex-col items-center p-2 rounded-xl transition-colors ${activeTab === 'reports' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <BarChart className="w-6 h-6 mb-1" />
              <span className="text-xs font-medium">Raporty</span>
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex flex-col items-center p-2 rounded-xl transition-colors ${activeTab === 'admin' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Settings className="w-6 h-6 mb-1" />
              <span className="text-xs font-medium">Admin</span>
            </button>
          </>
        )}
      </nav>
    </div>
  );
}

function LoginScreen({ user, setAppUser }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !name) return;
    setIsSubmitting(true);

    const normalizedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    try {
      const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');
      const q = query(usersRef, where('email', '==', normalizedEmail));
      const snap = await getDocs(q);

      let userData;

      if (!snap.empty) {
        const existing = snap.docs[0];
        userData = {
          id: existing.id,
          ...existing.data(),
          name: trimmedName || existing.data().name
        };

        if (existing.data().name !== trimmedName && trimmedName) {
          await setDoc(
            doc(db, 'artifacts', appId, 'public', 'data', 'users', existing.id),
            { name: trimmedName },
            { merge: true }
          );
        }
      } else {
        userData = {
          uid: user.uid,
          email: normalizedEmail,
          name: trimmedName,
          createdAt: new Date().toISOString()
        };

        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), userData);
      }

      localStorage.setItem('peptech_email', normalizedEmail);
      localStorage.setItem('peptech_name', trimmedName);

      setAppUser(userData);
    } catch (err) {
      console.error('Błąd podczas logowania:', err);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-white p-6 justify-center">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Calendar className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800">Witaj w PeptechLab Team Schedule</h1>
        <p className="text-slate-500 mt-2">Podaj swoje dane, aby wejść do aplikacji.</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Imię i Nazwisko</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-slate-300 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            placeholder="np. Jan Kowalski"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Adres e-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-slate-300 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            placeholder="jan@firma.pl"
            required
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 text-white font-semibold p-4 rounded-xl mt-4 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-70"
        >
          {isSubmitting ? 'Zapisywanie...' : 'Wejdź do aplikacji'}
        </button>
      </form>
    </div>
  );
}

function MySchedule({ appUser, schedules }) {
  const days = useMemo(() => getNext30Days(), []);
  const [editingDay, setEditingDay] = useState(null);

  const mySchedulesMap = useMemo(() => {
    const map = {};
    schedules
      .filter((s) => s.userEmail === appUser.email)
      .forEach((s) => {
        map[s.date] = s;
      });
    return map;
  }, [schedules, appUser.email]);

  const handleDayClick = (date) => {
    setEditingDay({
      date,
      existingSchedule: mySchedulesMap[date] || null
    });
  };

  const closeEdit = () => setEditingDay(null);

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold text-slate-800 mb-4 px-1">Plan na najbliższe dni</h2>

      <div className="space-y-3">
        {days.map((date) => {
          const schedule = mySchedulesMap[date];
          const today = isToday(date);

          return (
            <button
              key={date}
              onClick={() => handleDayClick(date)}
              className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between shadow-sm
                ${today ? 'border-blue-300 bg-blue-50/50' : 'border-slate-200 bg-white hover:border-blue-300'}`}
            >
              <div>
                <span className={`text-sm font-medium ${today ? 'text-blue-700' : 'text-slate-600'}`}>
                  {formatDateDisplay(date)} {today && '(Dzisiaj)'}
                </span>
                <div className="mt-1">
                  <StatusDisplay status={schedule?.status} />
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300" />
            </button>
          );
        })}
      </div>

      {editingDay && (
        <EditScheduleModal
          appUser={appUser}
          date={editingDay.date}
          existingSchedule={editingDay.existingSchedule}
          onClose={closeEdit}
        />
      )}
    </div>
  );
}

function TeamSchedule({ schedules }) {
  const days = useMemo(() => getNext30Days(), []);
  const [selectedDate, setSelectedDate] = useState(getSmartDefaultDate());

  const daySchedules = useMemo(() => {
    return schedules.filter((s) => s.date === selectedDate);
  }, [schedules, selectedDate]);

  const currentIndex = days.indexOf(selectedDate);

  const handlePrevDay = () => {
    if (currentIndex > 0) setSelectedDate(days[currentIndex - 1]);
  };

  const handleNextDay = () => {
    if (currentIndex < days.length - 1) setSelectedDate(days[currentIndex + 1]);
  };

  return (
    <div className="p-4 flex flex-col h-full">
      <div className="flex items-center justify-between bg-white p-2 rounded-2xl shadow-sm border border-slate-100 mb-6 mt-2">
        <button
          onClick={handlePrevDay}
          disabled={currentIndex === 0}
          className="p-2 text-slate-400 hover:text-blue-600 disabled:opacity-30"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="text-center">
          <p className="text-sm text-slate-500 font-medium">Grafik na dzień:</p>
          <p className="text-lg font-bold text-slate-800">
            {formatDateDisplay(selectedDate)}
            {isToday(selectedDate) && <span className="text-blue-600 ml-2 text-sm font-normal">(Dzisiaj)</span>}
          </p>
        </div>
        <button
          onClick={handleNextDay}
          disabled={currentIndex === days.length - 1}
          className="p-2 text-slate-400 hover:text-blue-600 disabled:opacity-30"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
        {daySchedules.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <Users className="w-12 h-12 mb-3 opacity-20" />
            <p>Nikt jeszcze nie określił statusu na ten dzień.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {daySchedules.map((schedule) => (
              <div key={schedule.id} className="flex items-center justify-between border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold">
                    {schedule.userName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{schedule.userName}</p>
                    {schedule.status !== 'absent' && (
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {schedule.startTime} - {schedule.endTime}
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <StatusIcon status={schedule.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EditScheduleModal({ appUser, date, existingSchedule, onClose }) {
  const [status, setStatus] = useState(existingSchedule?.status || 'office');
  const [startTime, setStartTime] = useState(existingSchedule?.startTime || '08:00');
  const [endTime, setEndTime] = useState(existingSchedule?.endTime || '16:00');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const sanitizedEmail = appUser.email.replace(/[^a-zA-Z0-9]/g, '_');
      const docId = `${sanitizedEmail}_${date}`;

      const newScheduleData = {
        userEmail: appUser.email,
        userName: appUser.name,
        date,
        status,
        startTime: status === 'absent' ? '' : startTime,
        endTime: status === 'absent' ? '' : endTime,
        lastUpdated: new Date().toISOString()
      };

      const scheduleRef = doc(db, 'artifacts', appId, 'public', 'data', 'schedules', docId);
      await setDoc(scheduleRef, newScheduleData, { merge: true });

      const historyRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'historyLog'));
      await setDoc(historyRef, {
        timestamp: new Date().toISOString(),
        userEmail: appUser.email,
        userName: appUser.name,
        targetDate: date,
        oldStatus: existingSchedule?.status || null,
        newStatus: status
      });

      onClose();
    } catch (err) {
      console.error('Błąd zapisu:', err);
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-bold text-slate-800">Ustaw status</h3>
            <p className="text-sm text-slate-500">{formatDateDisplay(date)}</p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-6">
          <StatusOption
            icon={<Building className="w-6 h-6 mb-1" />}
            label="Biuro"
            selected={status === 'office'}
            onClick={() => setStatus('office')}
            colorClass="bg-blue-50 text-blue-700 border-blue-200"
          />
          <StatusOption
            icon={<Home className="w-6 h-6 mb-1" />}
            label="Zdalnie"
            selected={status === 'remote'}
            onClick={() => setStatus('remote')}
            colorClass="bg-emerald-50 text-emerald-700 border-emerald-200"
          />
          <StatusOption
            icon={<Palmtree className="w-6 h-6 mb-1" />}
            label="Nieobecność"
            selected={status === 'absent'}
            onClick={() => setStatus('absent')}
            colorClass="bg-orange-50 text-orange-700 border-orange-200"
          />
        </div>

        {status !== 'absent' && (
          <div className="flex gap-4 mb-8">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Od godziny</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Do godziny</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium"
              />
            </div>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 mt-4"
        >
          {isSaving ? 'Zapisywanie...' : 'Zapisz status'}
        </button>
      </div>
    </div>
  );
}

function StatusOption({ icon, label, selected, onClick, colorClass }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all
        ${selected ? colorClass : 'border-slate-100 bg-white text-slate-400 hover:bg-slate-50'}`}
    >
      {icon}
      <span className="text-xs font-semibold">{label}</span>
    </button>
  );
}

function StatusDisplay({ status }) {
  if (!status) return <span className="text-sm font-medium text-slate-400 bg-slate-100 px-3 py-1 rounded-lg">Brak wpisu</span>;

  const config = {
    office: { icon: <Building className="w-4 h-4 mr-1.5" />, text: 'W biurze', style: 'bg-blue-100 text-blue-700' },
    remote: { icon: <Home className="w-4 h-4 mr-1.5" />, text: 'Zdalnie', style: 'bg-emerald-100 text-emerald-700' },
    absent: { icon: <Palmtree className="w-4 h-4 mr-1.5" />, text: 'Nieobecność', style: 'bg-orange-100 text-orange-700' }
  };

  const conf = config[status];
  return (
    <span className={`inline-flex items-center text-sm font-semibold px-3 py-1 rounded-lg ${conf.style}`}>
      {conf.icon} {conf.text}
    </span>
  );
}

function StatusIcon({ status }) {
  const config = {
    office: { icon: <Building className="w-5 h-5" />, style: 'bg-blue-100 text-blue-600' },
    remote: { icon: <Home className="w-5 h-5" />, style: 'bg-emerald-100 text-emerald-600' },
    absent: { icon: <Palmtree className="w-5 h-5" />, style: 'bg-orange-100 text-orange-600' }
  };

  const conf = config[status];
  return (
    <div className={`p-2 rounded-xl flex items-center justify-center ${conf.style}`} title={status}>
      {conf.icon}
    </div>
  );
}

function AdminPanel() {
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const logsRef = collection(db, 'artifacts', appId, 'public', 'data', 'historyLog');
    const unsubscribeLogs = onSnapshot(logsRef, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setLogs(data);
    });

    const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');
    const unsubscribeUsers = onSnapshot(usersRef, (snapshot) => {
      setUsers(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => {
      unsubscribeLogs();
      unsubscribeUsers();
    };
  }, []);

  const handleCopy = async () => {
    const baseUrl = window.location.origin + window.location.pathname;

    try {
      await navigator.clipboard.writeText(baseUrl);
    } catch (e) {
      try {
        const input = document.createElement('input');
        input.value = baseUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      } catch (err) {
        console.error('Błąd kopiowania', err);
      }
    }

    setCopiedLink('employee');
    setTimeout(() => setCopiedLink(''), 2000);
  };

  const handleDeleteUser = async (userId) => {
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', userId));
      setDeletingId(null);
    } catch (error) {
      console.error('Błąd usuwania użytkownika:', error);
    }
  };

  const formatLogTime = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const translateStatus = (s) => {
    if (s === 'office') return 'Biuro';
    if (s === 'remote') return 'Zdalnie';
    if (s === 'absent') return 'Nieobecność';
    return 'Brak wpisu';
  };

  if (loading) return <div className="p-4 text-center text-slate-500">Ładowanie panelu...</div>;

  return (
    <div className="p-4 pb-10 space-y-6">
      <section>
        <h2 className="text-lg font-bold text-slate-800 mb-3 px-1 flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-600" /> Udostępnianie
        </h2>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">Link do aplikacji:</p>
            <button
              onClick={handleCopy}
              className="w-full flex items-center justify-between bg-slate-50 border border-slate-200 p-3 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <span className="text-xs text-slate-500 truncate mr-2">Skopiuj standardowy link</span>
              {copiedLink === 'employee' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-400" />}
            </button>
            <p className="text-xs text-slate-400 mt-2">Uprawnienia admina przyznawane są automatycznie dla autoryzowanych adresów e-mail.</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-800 mb-3 px-1 flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-600" /> Zarządzanie zespołem
        </h2>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between p-3 border-b border-slate-50 last:border-0">
              <div className="truncate pr-2">
                <p className="font-semibold text-sm text-slate-800 truncate">{u.name}</p>
                <p className="text-xs text-slate-500 truncate">{u.email}</p>
              </div>

              {deletingId === u.id ? (
                <div className="flex gap-2">
                  <button onClick={() => handleDeleteUser(u.id)} className="bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-600">
                    Usuń
                  </button>
                  <button onClick={() => setDeletingId(null)} className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-xs hover:bg-slate-200">
                    Anuluj
                  </button>
                </div>
              ) : (
                <button onClick={() => setDeletingId(u.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          {users.length === 0 && <p className="p-4 text-center text-sm text-slate-500">Brak zarejestrowanych osób.</p>}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-800 mb-3 px-1 flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-600" /> Historia zmian
        </h2>
        {logs.length === 0 ? (
          <p className="text-sm text-slate-500 text-center mt-4">Brak zapisanych zmian.</p>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm text-sm">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-semibold text-slate-700">{log.userName || log.userEmail}</span>
                  <span className="text-xs text-slate-400">{formatLogTime(log.timestamp)}</span>
                </div>
                <div className="text-slate-600 mb-1">
                  Zaktualizowano plan na dzień: <span className="font-medium text-slate-800">{formatDateDisplay(log.targetDate)}</span>
                </div>
                <div className="flex items-center text-xs mt-2">
                  <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded-md">{translateStatus(log.oldStatus)}</span>
                  <ChevronRight className="w-4 h-4 mx-1 text-slate-300" />
                  <span className="bg-blue-50 text-blue-600 font-medium px-2 py-1 rounded-md">{translateStatus(log.newStatus)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ReportsPanel({ schedules }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const months = useMemo(() => {
    const result = [];
    const d = new Date();
    for (let i = 0; i < 12; i++) {
      result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      d.setMonth(d.getMonth() - 1);
    }
    return result;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState(months[0]);

  useEffect(() => {
    const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');
    const unsub = onSnapshot(usersRef, (snap) => {
      setUsers(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const stats = useMemo(() => {
    const monthSchedules = schedules.filter((s) => s.date.startsWith(selectedMonth));
    const userStats = {};

    users.forEach((u) => {
      userStats[u.email] = {
        name: u.name,
        officeDays: 0,
        officeHours: 0,
        remoteDays: 0,
        remoteHours: 0,
        absentDays: 0
      };
    });

    monthSchedules.forEach((s) => {
      if (!userStats[s.userEmail]) {
        userStats[s.userEmail] = {
          name: s.userName,
          officeDays: 0,
          officeHours: 0,
          remoteDays: 0,
          remoteHours: 0,
          absentDays: 0
        };
      }
      const stat = userStats[s.userEmail];
      const hours = calculateHours(s.startTime, s.endTime);

      if (s.status === 'office') {
        stat.officeDays += 1;
        stat.officeHours += hours;
      } else if (s.status === 'remote') {
        stat.remoteDays += 1;
        stat.remoteHours += hours;
      } else if (s.status === 'absent') {
        stat.absentDays += 1;
      }
    });

    return Object.values(userStats).sort((a, b) => a.name.localeCompare(b.name));
  }, [schedules, selectedMonth, users]);

  if (loading) return <div className="p-4 text-center text-slate-500">Ładowanie raportów...</div>;

  return (
    <div className="p-4 pb-10 space-y-6">
      <section>
        <h2 className="text-lg font-bold text-slate-800 mb-3 px-1 flex items-center gap-2">
          <BarChart className="w-5 h-5 text-blue-600" /> Podsumowanie zespołu
        </h2>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm mb-4">
          <label className="block text-sm font-semibold text-slate-700 mb-2">Wybierz miesiąc:</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium capitalize"
          >
            {months.map((m) => (
              <option key={m} value={m}>{formatMonthDisplay(m)}</option>
            ))}
          </select>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3 min-w-[120px]">Pracownik</th>
                <th className="p-3 text-center min-w-[90px]">Biuro<br /><span className="text-xs font-normal text-slate-400">Dni / Godz.</span></th>
                <th className="p-3 text-center min-w-[90px]">Zdalnie<br /><span className="text-xs font-normal text-slate-400">Dni / Godz.</span></th>
                <th className="p-3 text-center min-w-[70px]">Urlop<br /><span className="text-xs font-normal text-slate-400">Dni</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.length > 0 ? stats.map((user) => (
                <tr key={user.name} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-medium text-slate-800">{user.name}</td>
                  <td className="p-3 text-center">
                    <span className="font-semibold text-slate-700">{user.officeDays}</span>
                    <span className="text-slate-400 mx-1">/</span>
                    <span className="text-blue-600 font-medium">{user.officeHours}h</span>
                  </td>
                  <td className="p-3 text-center">
                    <span className="font-semibold text-slate-700">{user.remoteDays}</span>
                    <span className="text-slate-400 mx-1">/</span>
                    <span className="text-emerald-600 font-medium">{user.remoteHours}h</span>
                  </td>
                  <td className="p-3 text-center">
                    <span className="font-semibold text-orange-600">{user.absentDays}</span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="4" className="p-4 text-center text-slate-500">Brak danych.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
