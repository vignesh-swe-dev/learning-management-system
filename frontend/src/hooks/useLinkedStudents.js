import { useEffect, useState } from 'react';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

// Names of the students a parent is linked to.
export function useLinkedStudents() {
  const { user } = useAuth();
  const [students, setStudents] = useState(null);
  useEffect(() => {
    if (user.role !== 'parent') return;
    Promise.all((user.linkedStudents || []).map((id) => api.get(`/users/${id}`).then((r) => r.data.user)))
      .then(setStudents).catch(() => setStudents([]));
  }, [user]);
  return students;
}
