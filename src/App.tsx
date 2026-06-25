import { Route, Routes } from 'react-router-dom'
import OrderEntryPage from './pages/customer/OrderEntryPage'
import LoginPage from './pages/staff/LoginPage'
import StaffHomePage from './pages/staff/StaffHomePage'
import StationSelectPage from './pages/staff/StationSelectPage'
import CallBoardPage from './pages/staff/CallBoardPage'
import OrderBoardPage from './pages/staff/OrderBoardPage'

function App() {
  return (
    <Routes>
      <Route path="/t/:tableId" element={<OrderEntryPage />} />
      <Route path="/staff/login" element={<LoginPage />} />
      <Route path="/staff/station" element={<StationSelectPage />} />
      <Route path="/staff/calls" element={<CallBoardPage />} />
      <Route path="/staff/orders" element={<OrderBoardPage />} />
      <Route path="/staff" element={<StaffHomePage />} />
    </Routes>
  )
}

export default App
