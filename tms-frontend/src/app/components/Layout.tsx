import { Navigate, Outlet, Link, useLocation, useNavigate } from "react-router";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  ClipboardList,
  DollarSign,
  BookOpen,
  LogOut,
  MessageSquare,
  Shield,
  UserCircle,
  BadgeCheck,
} from "lucide-react";

import { clearAuthSession, getAccessToken, getStoredTeacher } from "../services/authStorage";

type NavItem = {
  path: string;
  icon: typeof LayoutDashboard;
  label: string;
};

const teacherNavItems: NavItem[] = [
  { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/students", icon: Users, label: "Học sinh" },
  { path: "/classes", icon: GraduationCap, label: "Lớp học" },
  { path: "/sessions", icon: ClipboardList, label: "Buổi học" },
  { path: "/topics", icon: BookOpen, label: "Chuyên đề" },
  { path: "/messaging", icon: MessageSquare, label: "Discord" },
  { path: "/transactions", icon: DollarSign, label: "Tài chính" },
];

const sysAdminNavItems: NavItem[] = [
  { path: "/admin/teachers", icon: Shield, label: "Quản trị tài khoản" },
];

function isNavItemActive(currentPath: string, itemPath: string): boolean {
  if (currentPath === itemPath) {
    return true;
  }

  return currentPath.startsWith(`${itemPath}/`);
}

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const accessToken = getAccessToken();
  const teacher = getStoredTeacher();

  if (!accessToken || !teacher || !teacher.is_active) {
    clearAuthSession();
    return <Navigate to="/login" replace />;
  }

  const navItems = teacher.role === "sysadmin" ? sysAdminNavItems : teacherNavItems;

  const handleLogout = () => {
    clearAuthSession();
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-zinc-50 text-zinc-900">
      <aside className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col">
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800 text-white">
              <GraduationCap className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-semibold text-white">CP Training</h1>
          </div>
          <div className="mt-4 rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-3">
            <div className="flex items-center gap-2 text-sm text-white">
              <UserCircle className="h-4 w-4 text-zinc-400" />
              <span className="font-medium">{teacher.username}</span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
              <BadgeCheck className="h-4 w-4" />
              <span>{teacher.role === "sysadmin" ? "Admin" : "Teacher"}</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isNavItemActive(location.pathname, item.path);

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  active
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-500 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-zinc-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-white transition-colors w-full"
          >
            <LogOut className="w-5 h-5" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
