import { Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { Create } from './pages/Create';
import { Explore } from './pages/Explore';
import { McpDetail } from './pages/McpDetail';
import { NotFound } from './pages/NotFound';
import { StoreProvider } from './store/store';
import { ToastProvider } from './store/toast';

export function App() {
  return (
    <ToastProvider>
      <StoreProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Explore />} />
            <Route path="mcp/:slug" element={<McpDetail />} />
            <Route path="crear" element={<Create />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </StoreProvider>
    </ToastProvider>
  );
}
