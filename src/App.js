import React, { useState } from 'react';
import './App.css';
import Aavak from './Aavak';
import Javak from './Javak';
import Employees from './Employees';
import Bardana from './Bardana';
import AdminPanel from './AdminPanel';
import CashManagement from './CashManagement';
import Dashboard from './components/Dashboard';
import RTGSPanel from './RTGSPanel'; // imported perfectly!
import { db } from './firebaseConfig';
import { doc, getDoc, collection, query, where, getDocs, setDoc } from 'firebase/firestore';
import { LayoutDashboard, ArrowDownLeft, ArrowUpRight, Menu, X, Users, Package, LogOut, Key, Shield, Moon, Sun, IndianRupee, Landmark } from 'lucide-react'; // Added Landmark icon for banking
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from './ThemeContext';

function App() {
    const { darkMode, toggleDarkMode } = useTheme();
    const [view, setView] = useState('dashboard');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [user, setUser] = useState(null);
    const [loginId, setLoginId] = useState('');
    const [loginError, setLoginError] = useState('');
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [isBootstrapping, setIsBootstrapping] = useState(true);

    React.useEffect(() => {
        const bootstrap = async () => {
            try {
                const q = query(collection(db, 'employees'), where('role', 'in', ['admin', 'ADMIN']));
                const snap = await getDocs(q);
                if (snap.empty) {
                    await setDoc(doc(db, 'employees', 'ADMIN'), {
                        name: 'Admin User',
                        employeeId: 'ADMIN',
                        role: 'ADMIN',
                        joiningYear: new Date().getFullYear(),
                        phone: '0000000000',
                        timestamp: new Date()
                    });
                }
            } catch (e) {
                console.error("Bootstrap error", e);
            } finally {
                setIsBootstrapping(false);
            }
        };
        bootstrap();
    }, []);

    React.useEffect(() => {
        const handleCustomViewChange = (e) => {
            if (e.detail && typeof e.detail === 'string') {
                handleViewChange(e.detail);
            }
        };
        window.addEventListener('changeView', handleCustomViewChange);
        return () => window.removeEventListener('changeView', handleCustomViewChange);
    }, []);

    // FIXED HERE: Added RTGS Panel to navigation conditionally (Strictly Admin only)
    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'aavak', label: 'आवक (Incoming)', icon: ArrowDownLeft },
        { id: 'javak', label: 'जावक (Outgoing)', icon: ArrowUpRight },
        { id: 'bardana', label: 'Bardana', icon: Package },
        { id: 'employees', label: 'Employees', icon: Users },
        ...(user?.role?.toUpperCase() === 'ADMIN' || user?.employeeId === 'ADMIN' || user?.role?.toUpperCase() === 'CASHIER' ? [{ id: 'cash', label: 'Cash Management', icon: IndianRupee }] : []),
        ...(user?.role?.toUpperCase() === 'ADMIN' || user?.employeeId === 'ADMIN' ? [{ id: 'rtgs', label: 'RTGS Panel', icon: Landmark }] : []), // Admin Only Bank Tracker
        ...(user?.role?.toUpperCase() === 'ADMIN' || user?.employeeId === 'ADMIN' ? [{ id: 'admin', label: 'Admin Panel', icon: Shield }] : []),
    ];

    const handleLogin = async (e) => {
        e.preventDefault();
        const trimmedId = loginId.trim().toUpperCase();
        if (!trimmedId) return;
        try {
            const empRef = doc(db, 'employees', trimmedId);
            const empSnap = await getDoc(empRef);
            if (empSnap.exists()) {
                setUser(empSnap.data());
                setLoginError('');
                setIsLoginModalOpen(false); // Close dashboard auth modal on success
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
        setIsMobileMenuOpen(false);
    };

    const handleViewChange = (newView) => {
        setView(newView);
        setIsMobileMenuOpen(false);
    };

    // FIXED HERE: Added case 'rtgs' handler inside renderView logic
    const renderView = () => {
        if (isBootstrapping) return <div className="flex items-center justify-center p-8 text-slate-400">Initializing...</div>;

        if (['aavak', 'javak', 'bardana', 'employees', 'cash', 'rtgs', 'admin'].includes(view) && !user) {
            return (
                <div className="flex items-center justify-center p-8">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-800"
                    >
                        <div className="p-6 bg-indigo-600 text-white text-center">
                            <Key className="w-8 h-8 mx-auto mb-2" />
                            <h2 className="text-xl font-bold">Login Required</h2>
                            <p className="text-indigo-100 text-sm">Please login to access this section</p>
                        </div>
                        <form onSubmit={handleLogin} className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Employee ID</label>
                                <input 
                                    type="text" 
                                    className="input-field uppercase dark:bg-slate-800 dark:border-slate-700 dark:text-white" 
                                    placeholder="e.g., PRAD10"
                                    value={loginId}
                                    onChange={(e) => setLoginId(e.target.value.replace(/\s/g, ''))}
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
                return <Employees currentUser={user} />;
            case 'cash':
                return <CashManagement currentUser={user} />;
            case 'rtgs':
                return <RTGSPanel currentUser={user} />; // Renders the component beautifully!
            case 'admin':
                return <AdminPanel currentUser={user} />;
            default:
                return <Dashboard currentUser={user} />;
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex">
            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 md:hidden"
                    />
                )}
            </AnimatePresence>

            {/* Mobile Sidebar */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.aside 
                        initial={{ x: '-100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '-100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed inset-y-0 left-0 w-72 bg-white dark:bg-slate-900 z-50 md:hidden flex flex-col shadow-2xl"
                    >
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-indigo-600 dark:bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100 dark:shadow-none">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c-1.2 0-2.4.4-3.3 1.2a5 5 0 00-7.2 7.2c.8.9 1.2 2.1 1.2 3.3a5 5 0 007.2 7.2c.9-.8 2.1-1.2 3.3-1.2s2.4.4 3.3 1.2a5 5 0 007.2-7.2c-.8-.9-1.2-2.1-1.2-3.3s.4-2.4 1.2-3.3a5 5 0 00-7.2-7.2c-.9.8-2.1 1.2-3.3 1.2z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 12m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 14v5" />
                                    </svg>
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-black text-slate-900 dark:text-white leading-none tracking-tight">VENKATESH</span>
                                    <span className="text-[10px] font-bold text-indigo-600 tracking-[0.2em] mt-1">COTTON CO.</span>
                                </div>
                            </div>
                            <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-400">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <nav className="flex-1 p-4 space-y-2">
                            {navItems.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => handleViewChange(item.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                                        view === item.id 
                                        ? 'bg-indigo-50 text-indigo-600 font-semibold dark:bg-indigo-900/30 dark:text-indigo-400' 
                                        : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    <item.icon className="w-5 h-5" />
                                    <span>{item.label}</span>
                                </button>
                            ))}
                        </nav>
                        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
                            {user && (
                                <button 
                                    onClick={handleLogout}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                                >
                                    <LogOut className="w-5 h-5" />
                                    <span className="font-semibold">Logout</span>
                                </button>
                            )}
                        </div>
                    </motion.aside>
                )}
            </AnimatePresence>

            {/* Sidebar */}
            <aside className={`sticky top-0 h-screen bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'} hidden md:flex flex-col`}>
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600 dark:bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100 dark:shadow-none">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c-1.2 0-2.4.4-3.3 1.2a5 5 0 00-7.2 7.2c.8.9 1.2 2.1 1.2 3.3a5 5 0 007.2 7.2c.9-.8 2.1-1.2 3.3-1.2s2.4.4 3.3 1.2a5 5 0 007.2-7.2c-.8-.9-1.2-2.1-1.2-3.3s.4-2.4 1.2-3.3a5 5 0 00-7.2-7.2c-.9.8-2.1 1.2-3.3 1.2z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 12m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 14v5" />
                        </svg>
                    </div>
                    {isSidebarOpen && (
                        <div className="flex flex-col">
                            <span className="font-black text-slate-900 dark:text-white leading-none tracking-tight uppercase">VENKATESH</span>
                            <span className="text-[10px] font-bold text-indigo-600 tracking-[0.2em] mt-1 uppercase">COTTON CO.</span>
                        </div>
                    )}
                </div>
                
                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => handleViewChange(item.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                                view === item.id 
                                ? 'bg-indigo-50 text-indigo-600 font-semibold dark:bg-indigo-900/30 dark:text-indigo-400' 
                                : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'
                            }`}
                        >
                            <item.icon className="w-5 h-5" />
                            {isSidebarOpen && <span>{item.label}</span>}
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
                    {user ? (
                        <>
                            <div className={`flex items-center gap-3 px-4 py-2 ${isSidebarOpen ? '' : 'justify-center'}`}>
                                <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-400 font-bold text-xs uppercase">
                                    {user.name.substring(0, 2).toUpperCase()}
                                </div>
                                {isSidebarOpen && (
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate uppercase">{user.name}</p>
                                        <p className="text-[10px] text-slate-400 font-mono uppercase">{user.employeeId}</p>
                                    </div>
                                )}
                            </div>
                            <button 
                                onClick={handleLogout}
                                className={`w-full flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all ${isSidebarOpen ? '' : 'justify-center'}`}
                            >
                                <LogOut className="w-5 h-5" />
                                {isSidebarOpen && <span className="text-sm font-semibold uppercase">Logout</span>}
                            </button>
                        </>
                    ) : (
                        <div className={`p-2 text-center text-xs text-slate-400 uppercase ${isSidebarOpen ? '' : 'hidden'}`}>
                            Login required
                        </div>
                    )}
                    <button 
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="w-full flex items-center justify-center p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    >
                        {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-950">
                <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 md:p-6 flex justify-between items-center sticky top-0 z-30">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-slate-600 dark:text-slate-400">
                            <Menu className="w-6 h-6" />
                        </button>
                        <h1 className="text-xl font-bold text-slate-900 dark:text-white uppercase">
                            {navItems.find(i => i.id === view)?.label}
                        </h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={toggleDarkMode}
                            className="p-2 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors"
                            title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                        >
                            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                        </button>
                        {user ? (
                            <button 
                                onClick={handleLogout}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 dark:text-rose-400 text-xs font-bold rounded-xl transition-all border border-rose-200 dark:border-rose-900 shadow-sm uppercase tracking-wider"
                                title="Log Out"
                            >
                                <LogOut className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Logout</span>
                            </button>
                        ) : (
                            <button 
                                onClick={() => {
                                    setLoginError('');
                                    setLoginId('');
                                    setIsLoginModalOpen(true);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/40 dark:text-indigo-400 text-xs font-bold rounded-xl transition-all border border-indigo-200 dark:border-indigo-900 shadow-sm uppercase tracking-wider"
                                title="Log In"
                            >
                                <Key className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Login</span>
                            </button>
                        )}
                        <span className="text-sm font-black text-slate-900 dark:text-white hidden sm:inline tracking-widest uppercase">VENKATESH COTTON COMPANY</span>
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

            {/* Login Modal Overlay */}
            <AnimatePresence>
                {isLoginModalOpen && (
                    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: -20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
                        >
                            <div className="p-6 bg-indigo-600 text-white text-center relative">
                                <button 
                                    onClick={() => setIsLoginModalOpen(false)}
                                    className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors animate-in duration-200"
                                    type="button"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                                <Key className="w-8 h-8 mx-auto mb-2 text-indigo-100" />
                                <h2 className="text-xl font-black uppercase tracking-wider">Employee Terminal</h2>
                                <p className="text-indigo-200 text-xs font-bold uppercase mt-1">Provide credentials to authenticate</p>
                            </div>
                            <form onSubmit={handleLogin} className="p-6 space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Username / Employee ID</label>
                                    <input 
                                        type="text" 
                                        className="input-field uppercase dark:bg-slate-800 dark:border-slate-700 dark:text-white font-mono" 
                                        placeholder="e.g., PRAD10"
                                        value={loginId}
                                        onChange={(e) => setLoginId(e.target.value.replace(/\s/g, ''))}
                                        required
                                        autoFocus
                                    />
                                    {loginError && <p className="text-red-500 text-xs font-bold mt-1 uppercase tracking-wide">⚠️ {loginError}</p>}
                                </div>
                                <button type="submit" className="btn-primary w-full py-3.5 font-black uppercase tracking-widest text-xs mt-2 shadow-lg shadow-indigo-100 dark:shadow-none">
                                    Authenticate Connection
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default App;