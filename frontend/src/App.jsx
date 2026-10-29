import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute.jsx';
import AppLayout from './layouts/AppLayout.jsx';
const Login = lazy(() => import('./pages/Login.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Users = lazy(() => import('./pages/Users.jsx'));
const Courses = lazy(() => import('./pages/Courses.jsx'));
const CourseDetail = lazy(() => import('./pages/CourseDetail.jsx'));
const CourseEditor = lazy(() => import('./pages/CourseEditor.jsx'));
const MyCourses = lazy(() => import('./pages/MyCourses.jsx'));
const LessonPlayer = lazy(() => import('./pages/LessonPlayer.jsx'));
const Assignments = lazy(() => import('./pages/Assignments.jsx'));
const AssignmentDetail = lazy(() => import('./pages/AssignmentDetail.jsx'));
const Quizzes = lazy(() => import('./pages/Quizzes.jsx'));
const QuizPage = lazy(() => import('./pages/QuizPage.jsx'));
const QuizEditor = lazy(() => import('./pages/QuizEditor.jsx'));
const QuizAttempts = lazy(() => import('./pages/QuizAttempts.jsx'));
const Results = lazy(() => import('./pages/Results.jsx'));
const VerifyCertificate = lazy(() => import('./pages/VerifyCertificate.jsx'));
const LiveActivity = lazy(() => import('./pages/LiveActivity.jsx'));
const Attendance = lazy(() => import('./pages/Attendance.jsx'));
const Reports = lazy(() => import('./pages/Reports.jsx'));
const Discussions = lazy(() => import('./pages/Discussions.jsx'));
const DiscussionThread = lazy(() => import('./pages/DiscussionThread.jsx'));
const Messages = lazy(() => import('./pages/Messages.jsx'));
const Notifications = lazy(() => import('./pages/Notifications.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));

export default function App() {
  return (
    <Suspense fallback={<div className="p-4"><div className="skeleton" style={{ height: 24, width: 200 }} /></div>}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify" element={<VerifyCertificate />} />
      <Route path="/verify/:id" element={<VerifyCertificate />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/courses/:id" element={<CourseDetail />} />
          <Route path="/results" element={<Results />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/messages/:userId" element={<Messages />} />
          <Route element={<ProtectedRoute roles={['admin', 'instructor', 'student']} />}>
            <Route path="/courses/:courseId/discussions" element={<Discussions />} />
            <Route path="/courses/:courseId/discussions/:threadId" element={<DiscussionThread />} />
          </Route>
          <Route path="/settings" element={<Settings />} />
          <Route element={<ProtectedRoute roles={['admin', 'instructor']} />}>
            <Route path="/live" element={<LiveActivity />} />
          </Route>
          <Route element={<ProtectedRoute roles={['admin', 'instructor', 'student']} />}>
            <Route path="/reports" element={<Reports />} />
          </Route>
          <Route element={<ProtectedRoute roles={['admin', 'instructor', 'student']} />}>
            <Route path="/courses/:courseId/learn/:lessonId" element={<LessonPlayer />} />
            <Route path="/assignments" element={<Assignments />} />
            <Route path="/assignments/:id" element={<AssignmentDetail />} />
            <Route path="/quizzes" element={<Quizzes />} />
            <Route path="/quizzes/:id" element={<QuizPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={['admin', 'instructor']} />}>
            <Route path="/quizzes/new" element={<QuizEditor />} />
            <Route path="/quizzes/:id/edit" element={<QuizEditor />} />
            <Route path="/quizzes/:id/attempts" element={<QuizAttempts />} />
          </Route>
          <Route element={<ProtectedRoute roles={['admin', 'instructor']} />}>
            <Route path="/courses/new" element={<CourseEditor />} />
            <Route path="/courses/:id/edit" element={<CourseEditor />} />
          </Route>
          <Route element={<ProtectedRoute roles={['student']} />}>
            <Route path="/my-courses" element={<MyCourses />} />
          </Route>
          <Route element={<ProtectedRoute roles={['admin']} />}>
            <Route path="/users" element={<Users />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
    </Suspense>
  );
}
