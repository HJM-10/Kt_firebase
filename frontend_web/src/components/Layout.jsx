import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const Layout = () => (
  <div className="app-layout">
    <Sidebar />
    <div className="main-content">
      <div className="page-content">
        <Outlet />
      </div>
    </div>
  </div>
);

export default Layout;
