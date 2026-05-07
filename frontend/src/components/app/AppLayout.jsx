import AppSidebar from './AppSidebar';
import AppHeader from './AppHeader';

export default function AppLayout({ children }) {
  return (
    <div className="pe-shell">
      <AppSidebar />
      <div className="pe-shell__main">
        <AppHeader />
        <main className="pe-shell__content">{children}</main>
      </div>
    </div>
  );
}
