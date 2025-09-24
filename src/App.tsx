import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import OrdersTable from './components/OrdersTable';
import './App.css';
import { useNetwork } from './context/NetworkContext';

function Navigation() {
  const location = useLocation();
  const { network, setNetwork } = useNetwork();
  
  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <h1 className="text-xl font-bold text-gray-900">CowSwap Orders Dashboard</h1>
            </div>
            <div className="ml-10 flex items-center space-x-4">
              <Link
                to="/"
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  location.pathname === '/' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                Dashboard
              </Link>
              <Link
                to="/orders"
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  location.pathname === '/orders' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                Orders Table
              </Link>
            </div>
          </div>
          <div className="flex items-center">
            <label htmlFor="network-select" className="mr-2 text-sm text-gray-600">Network</label>
            <select
              id="network-select"
              value={network}
              onChange={(e) => setNetwork(e.target.value as any)}
              className="px-2 py-1 border border-gray-300 rounded-md text-sm bg-white"
            >
              <option value="arbitrum">Arbitrum</option>
              <option value="ethereum">Ethereum</option>
            </select>
          </div>
        </div>
      </div>
    </nav>
  );
}

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/orders" element={<OrdersTable />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
