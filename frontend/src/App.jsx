import { lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import SuperAdminRoute from './components/SuperAdminRoute';
import DashboardLayout from './layouts/DashboardLayout';
import LoginPage from './pages/LoginPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const EmployeesPage = lazy(() => import('./pages/EmployeesPage'));
const AttendancePage = lazy(() => import('./pages/AttendancePage'));
const SetLeavesPage = lazy(() => import('./pages/SetLeavesPage'));
const ActivitiesPage = lazy(() => import('./pages/ActivitiesPage'));
const LeavesPage = lazy(() => import('./pages/LeavesPage'));
const EmployeeLeaveBalancePage = lazy(() => import('./pages/EmployeeLeaveBalancePage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const OrganizationsPage = lazy(() => import('./pages/OrganizationsPage'));
const OrgFeatureSettingsPage = lazy(() => import('./pages/OrgFeatureSettingsPage'));
const EmployeeDetailsPage = lazy(() => import('./pages/details/EmployeeDetailsPage'));
const AttendanceDetailsPage = lazy(() => import('./pages/details/AttendanceDetailsPage'));
const ActivityDetailsPage = lazy(() => import('./pages/details/ActivityDetailsPage'));
const LeaveDetailsPage = lazy(() => import('./pages/details/LeaveDetailsPage'));
const OrganizationDetailsPage = lazy(() => import('./pages/details/OrganizationDetailsPage'));
const DepartmentDetailsPage = lazy(() => import('./pages/details/DepartmentDetailsPage'));
const EmployeeProfilePage = lazy(() => import('./pages/EmployeeProfilePage'));
const TelegramBotPage = lazy(() => import('./pages/TelegramBotPage'));
const TaskUpdatesPage = lazy(() => import('./pages/TaskUpdatesPage'));

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="employees/:employeeId" element={<EmployeeProfilePage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="set-leaves" element={<SetLeavesPage />} />
        <Route path="activities" element={<ActivitiesPage />} />
        <Route path="task-updates" element={<TaskUpdatesPage />} />
        <Route path="leaves" element={<LeavesPage />} />
        <Route path="leave-balance" element={<EmployeeLeaveBalancePage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="telegram-bot" element={<TelegramBotPage />} />
        <Route
          path="organizations"
          element={
            <SuperAdminRoute>
              <OrganizationsPage />
            </SuperAdminRoute>
          }
        />
        <Route path="org-settings" element={<OrgFeatureSettingsPage />} />
        <Route path="details/employees" element={<EmployeeDetailsPage />} />
        <Route path="details/attendance" element={<AttendanceDetailsPage />} />
        <Route path="details/activities" element={<ActivityDetailsPage />} />
        <Route path="details/leaves" element={<LeaveDetailsPage />} />
        <Route path="details/organizations" element={<OrganizationDetailsPage />} />
        <Route path="details/departments" element={<DepartmentDetailsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}