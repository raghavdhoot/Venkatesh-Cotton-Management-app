import React, { useState } from 'react';
import './App.css';
import Aavak from './Aavak';
import Javak from './Javak';
import Employees from './Employees';
import Bardana from './Bardana';
import Dashboard from './components/Dashboard';
import { db } from './firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { LayoutDashboard, ArrowDownLeft, ArrowUpRight, Menu, X, Users, Package, LogOut, Key } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function App() {
    const [view, setView] = useState('dashboard');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [user, setUser] = useState(null);
    const [loginId, setLoginId] = useState('');
    const [loginError, setLoginError] = useState('');

    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'aavak', label: 'आवक (Incoming)', icon: ArrowDownLeft },
        { id: 'javak', label: 'जावक (Outgoing)', icon: ArrowUpRight },
        { id: 'bardana', label: 'Bardana', icon: Package },
        { id: 'employees', label: 'Employees', icon: Users },
    ];

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!loginId) return;
        try {
            const empRef = doc(db, 'employees', loginId.toUpperCase());
            const empSnap = await getDoc(empRef);
            if (empSnap.exists()) {
                setUser(empSnap.data());
                setLoginError('');
            } else {
                setLoginError('Invalid Employee ID');
            }
        } catch (error) {
            console.error("Login error: ", error);
            setLoginError('Login failed. Try again.');
        }
    };

    const handleLogout = () => {
        setUser(null);
        setLoginId('');
        setView('dashboard');
    };

    const renderView = () => {
        if (['aavak', 'javak', 'bardana'].includes(view) && !user) {
            return (
                <div className="flex items-center justify-center p-8">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200"
                    >
                        <div className="p-6 bg-indigo-600 text-white text-center">
                            <Key className="w-8 h-8 mx-auto mb-2" />
                            <h2 className="text-xl font-bold">Login Required</h2>
                            <p className="text-indigo-100 text-sm">Please login to access this section</p>
                        </div>
                        <form onSubmit={handleLogin} className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-600">Employee ID</label>
                                <input 
                                    type="text" 
                                    className="input-field uppercase" 
                                    placeholder="e.g., PRAD10"
                                    value={loginId}
                                    onChange={(e) => setLoginId(e.target.value)}
                                    required
                                />
                                {loginError && <p className="text-red-500 text-xs font-semibold">{loginError}</p>}
                            </div>
                            <button type="submit" className="btn-primary w-full">
                                Login
                            </button>
                        </form>
                    </motion.div>
                </div>
            );
        }

        switch (view) {
            case 'aavak':
                return <Aavak currentUser={user} />;
            case 'javak':
                return <Javak currentUser={user} />;
            case 'bardana':
                return <Bardana currentUser={user} />;
            case 'employees':
                return <Employees />;
            default:
                return <Dashboard />;
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex">
            {/* Sidebar */}
            <aside className={`bg-white border-r border-slate-200 transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'} hidden md:flex flex-col`}>
                <div className="p-6 border-b border-slate-200 flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold">V</span>
                    </div>
                    {isSidebarOpen && <span className="font-bold text-slate-900 truncate">VCC Management</span>}
                </div>
                
                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setView(item.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                                view === item.id 
                                ? 'bg-indigo-50 text-indigo-600 font-semibold' 
                                : 'text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            <item.icon className="w-5 h-5" />
                            {isSidebarOpen && <span>{item.label}</span>}
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-slate-200 space-y-2">
                    {user ? (
                        <>
                            <div className={`flex items-center gap-3 px-4 py-2 ${isSidebarOpen ? '' : 'justify-center'}`}>
                                <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold text-xs">
                                    {user.name.substring(0, 2).toUpperCase()}
                                </div>
                                {isSidebarOpen && (
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-slate-900 truncate">{user.name}</p>
                                        <p className="text-[10px] text-slate-400 font-mono">{user.employeeId}</p>
                                    </div>
                                )}
                            </div>
                            <button 
                                onClick={handleLogout}
                                className={`w-full flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-all ${isSidebarOpen ? '' : 'justify-center'}`}
                            >
                                <LogOut className="w-5 h-5" />
                                {isSidebarOpen && <span className="text-sm font-semibold">Logout</span>}
                            </button>
                        </>
                    ) : (
                        <div className={`p-2 text-center text-xs text-slate-400 ${isSidebarOpen ? '' : 'hidden'}`}>
                            Login required for data entry
                        </div>
                    )}
                    <button 
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="w-full flex items-center justify-center p-2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0">
                <header className="bg-white border-b border-slate-200 p-4 md:p-6 flex justify-between items-center sticky top-0 z-10">
                    <div className="flex items-center gap-4">
                        <button className="md:hidden text-slate-600">
                            <Menu className="w-6 h-6" />
                        </button>
                        <h1 className="text-xl font-bold text-slate-900">
                            {navItems.find(i => i.id === view)?.label}
                        </h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-slate-500 hidden sm:inline">Venkatesh Cotton Company</span>
                    </div>
                </header>

                <div className="p-4 md:p-8 max-w-7xl mx-auto w-full">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={view}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            {renderView()}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </main>
        </div>
    );
}

export default App;
