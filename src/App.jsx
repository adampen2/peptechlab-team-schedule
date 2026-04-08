import { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { getAuth, signInWithRedirect, GoogleAuthProvider, signOut, onAuthStateChanged, getRedirectResult } from 'firebase/auth';
import './App.css';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

function App() {
  const [user, setUser] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [teamMember, setTeamMember] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
        // Handle redirect result from Google Sign In
    getRedirectResult(auth).then((result) => {
      if (result?.user) {
        setUser(result.user);
      }
    }).catch((error) => {
      console.error('Redirect error:', error);
    });

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    const q = query(collection(db, 'schedules'), orderBy('startDate'));
    const unsubscribeFirestore = onSnapshot(q, (snapshot) => {
      const schedulesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSchedules(schedulesData);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeFirestore();
    };
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithRedirect(auth, provider);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!teamMember || !startDate || !endDate) return;

    try {
      if (editingId) {
        await updateDoc(doc(db, 'schedules', editingId), {
          teamMember,
          startDate,
          endDate,
          updatedBy: user.email,
          updatedAt: new Date().toISOString()
        });
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'schedules'), {
          teamMember,
          startDate,
          endDate,
          createdBy: user.email,
          createdAt: new Date().toISOString()
        });
      }
      setTeamMember('');
      setStartDate('');
      setEndDate('');
    } catch (error) {
      console.error('Error adding/updating schedule:', error);
    }
  };

  const handleEdit = (schedule) => {
    setTeamMember(schedule.teamMember);
    setStartDate(schedule.startDate);
    setEndDate(schedule.endDate);
    setEditingId(schedule.id);
  };

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, 'schedules', id));
    } catch (error) {
      console.error('Error deleting schedule:', error);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setTeamMember('');
    setStartDate('');
    setEndDate('');
  };

  if (!user) {
    return (
      <div className="login-container">
        <div className="login-box">
          <h1>PeptechLab Team Schedule</h1>
          <p>Please sign in to manage the team schedule</p>
          <button onClick={handleLogin} className="login-btn">
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <h1>PeptechLab Team Schedule</h1>
        <div className="user-info">
          <span>Welcome, {user.displayName}</span>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        </div>
      </header>

      <main className="main">
        <form onSubmit={handleSubmit} className="schedule-form">
          <h2>{editingId ? 'Edit Schedule' : 'Add New Schedule'}</h2>
          <div className="form-group">
            <label htmlFor="teamMember">Team Member</label>
            <input
              type="text"
              id="teamMember"
              value={teamMember}
              onChange={(e) => setTeamMember(e.target.value)}
              placeholder="Enter team member name"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="startDate">Start Date</label>
            <input
              type="date"
              id="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="endDate">End Date</label>
            <input
              type="date"
              id="endDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="submit-btn">
              {editingId ? 'Update Schedule' : 'Add Schedule'}
            </button>
            {editingId && (
              <button type="button" onClick={cancelEdit} className="cancel-btn">
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="schedules-list">
          <h2>Team Schedules</h2>
          {schedules.length === 0 ? (
            <p className="empty-message">No schedules yet. Add your first schedule above!</p>
          ) : (
            <div className="schedules-grid">
              {schedules.map((schedule) => (
                <div key={schedule.id} className="schedule-card">
                  <h3>{schedule.teamMember}</h3>
                  <div className="schedule-dates">
                    <p><strong>Start:</strong> {new Date(schedule.startDate).toLocaleDateString()}</p>
                    <p><strong>End:</strong> {new Date(schedule.endDate).toLocaleDateString()}</p>
                  </div>
                  <div className="schedule-meta">
                    <small>Created by: {schedule.createdBy}</small>
                  </div>
                  <div className="schedule-actions">
                    <button onClick={() => handleEdit(schedule)} className="edit-btn">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(schedule.id)} className="delete-btn">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
