import { Route, Routes } from 'react-router-dom'
import OrderEntryPage from './pages/customer/OrderEntryPage'
import LoginPage from './pages/staff/LoginPage'
import StationSelectPage from './pages/staff/StationSelectPage'
import FloorBoardPage from './pages/staff/FloorBoardPage'
import TableLayoutPage from './pages/admin/TableLayoutPage'
import MenuManagePage from './pages/admin/MenuManagePage'
import NoticeManagePage from './pages/admin/NoticeManagePage'
import StationManagePage from './pages/admin/StationManagePage'

function App() {
  return (
    <Routes>
      <Route path="/t/:tableId" element={<OrderEntryPage />} />
      <Route path="/staff/login" element={<LoginPage />} />
      <Route path="/staff/station" element={<StationSelectPage />} />
      <Route path="/admin/table-layout" element={<TableLayoutPage />} />
      <Route path="/admin/menu" element={<MenuManagePage />} />
      <Route path="/admin/notice" element={<NoticeManagePage />} />
      <Route path="/admin/station" element={<StationManagePage />} />
      <Route path="/staff" element={<FloorBoardPage />} />
    </Routes>
  )
}

export default App
