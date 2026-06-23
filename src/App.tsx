import { Route, Routes } from 'react-router-dom'
import OrderEntryPage from './pages/customer/OrderEntryPage'
import LoginPage from './pages/staff/LoginPage'

function App() {
  return (
    <Routes>
      <Route path="/t/:tableId" element={<OrderEntryPage />} />
      <Route path="/staff/login" element={<LoginPage />} />
    </Routes>
  )
}

export default App
