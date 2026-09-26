import { HashRouter, Navigate, Route, Routes } from 'react-router';
import MainLayout from './layouts/main-layout';
import { useAppState } from './hooks/use-app-state';
import Login from './pages/login';
import Tag from './pages/tag';
import User from './pages/user';
import AuditLog from './pages/audit-log';

export function App() {
  const { state } = useAppState();

  return (
    <HashRouter>
      <Routes>
        {!state.isAuthenticated ? (
          <>
            <Route path="login" element={<Login />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        ) : (
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Navigate to="tags" replace />} />
            <Route path="tags" element={<Tag />} />
            <Route path="users" element={<User />} />
            <Route path="audit-logs" element={<AuditLog />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        )}
      </Routes>
    </HashRouter>
  );
}

export default App;
