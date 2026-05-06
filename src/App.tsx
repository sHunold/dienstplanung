import { BrowserRouter, Routes, Route } from 'react-router-dom'
import EmployeeForm from './components/EmployeeForm'
import AdminRoute from './components/AdminRoute'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<EmployeeForm />} />
        <Route path="/admin" element={<AdminRoute />} />
      </Routes>
    </BrowserRouter>
  )
}
