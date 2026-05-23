import { createBrowserRouter, redirect } from "react-router";
import { Dashboard } from "./pages/Dashboard";
import { Students } from "./pages/Students";
import { StudentDetail } from "./pages/StudentDetail";
import { Classes } from "./pages/Classes";
import { ClassDetail } from "./pages/ClassDetail";
import { Sessions } from "./pages/Sessions";
import { SessionDetail } from "./pages/SessionDetail";
import { Transactions } from "./pages/Transactions";
import { TopicStanding } from "./pages/TopicStanding";
import { Settings } from "./pages/Settings";
import { Login } from "./pages/Login";
import { Layout } from "./components/Layout";
import { AdminTeachers } from "./pages/AdminTeachers";
import type { TeacherRole } from "./services/authService";
import {
  clearAuthSession,
  getAccessToken,
  getDefaultHomePath,
  getStoredTeacher,
} from "./services/authStorage";

function getAuthenticatedTeacher() {
  const accessToken = getAccessToken();
  const teacher = getStoredTeacher();

  if (!accessToken || !teacher || !teacher.is_active) {
    clearAuthSession();
    return null;
  }

  return teacher;
}

function requireAuthLoader() {
  const teacher = getAuthenticatedTeacher();
  if (!teacher) {
    return redirect("/login");
  }

  return null;
}

function requireRoleLoader(roles: TeacherRole[]) {
  return () => {
    const teacher = getAuthenticatedTeacher();

    if (!teacher) {
      return redirect("/login");
    }

    if (!roles.includes(teacher.role)) {
      return redirect(getDefaultHomePath(teacher.role));
    }

    return null;
  };
}

function redirectToDefaultHome() {
  const teacher = getAuthenticatedTeacher();
  if (!teacher) {
    return redirect("/login");
  }

  return redirect(getDefaultHomePath(teacher.role));
}

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: Login,
    loader: () => {
      const teacher = getAuthenticatedTeacher();
      if (teacher) {
        return redirect(getDefaultHomePath(teacher.role));
      }

      return null;
    },
  },
  {
    path: "/",
    Component: Layout,
    loader: requireAuthLoader,
    children: [
      { index: true, loader: redirectToDefaultHome },
      { path: "dashboard", Component: Dashboard, loader: requireRoleLoader(["teacher"]) },
      { path: "students", Component: Students, loader: requireRoleLoader(["teacher"]) },
      { path: "students/:id", Component: StudentDetail, loader: requireRoleLoader(["teacher"]) },
      { path: "classes", Component: Classes, loader: requireRoleLoader(["teacher"]) },
      { path: "classes/:classId", Component: ClassDetail, loader: requireRoleLoader(["teacher"]) },
      { path: "sessions", Component: Sessions, loader: requireRoleLoader(["teacher"]) },
      { path: "sessions/:sessionId", Component: SessionDetail, loader: requireRoleLoader(["teacher"]) },
      { path: "transactions", Component: Transactions, loader: requireRoleLoader(["teacher"]) },
      { path: "classes/:classId/gyms/:gymId/standing", Component: TopicStanding, loader: requireRoleLoader(["teacher"]) },
      { path: "settings", Component: Settings, loader: requireRoleLoader(["teacher"]) },
      { path: "reports", loader: () => redirect("/transactions") },
      { path: "admin/teachers", Component: AdminTeachers, loader: requireRoleLoader(["sysadmin"]) },
    ],
  },
]);
