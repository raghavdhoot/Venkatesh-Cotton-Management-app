import React, { useState, useEffect } from 'react';
import { db } from './firebaseConfig';
import { collection, onSnapshot, query, orderBy, serverTimestamp, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { UserPlus, Trash2, User, Calendar, ShieldCheck, Phone, X, Share2, CheckCircle2 } from 'lucide-react';

function Employees({ currentUser }) {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');
    const [joiningYear, setJoiningYear] = useState(new Date().getFullYear().toString());
    const [role, setRole] = useState('KATA');
    const [customRole, setCustomRole] = useState('');
    const [employees, setEmployees] = useState([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });
    const [lastRegistered, setLastRegistered] = useState(null);

    const isAdmin = currentUser?.role?.toUpperCase() === 'ADMIN' || currentUser?.employeeId === 'ADMIN';

    // Strict 10-digit phone number format, applies to the Phone Number input below.
    const PHONE_REGEX = /^[0-9]{10}$/;
    const isValidPhone = (val) => PHONE_REGEX.test(val || '');

    useEffect(() => {
        if (statusMessage.text) {
            const timer = setTimeout(() => setStatusMessage({ text: '', type: '' }), 3000);
            return () => clearTimeout(timer);
        }
    }, [statusMessage]);

    useEffect(() => {
        const q = query(collection(db, 'employees'), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const empData = snapshot.docs
                .map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                .filter(emp => emp.employeeId !== 'ADMIN');
            setEmployees(empData);
        });
        return () => unsubscribe();
    }, []);

    const generateUniqueId = (name, year, existingEmployees) => {
        const prefix = name.substring(0, 4).toUpperCase().padEnd(4, 'X');
        const baseSuffix = parseInt(year.substring(year.length - 2), 10);
        
        let currentSuffix = baseSuffix;
        let finalId = `${prefix}${currentSuffix}`;
        
        const existingIds = existingEmployees.map(emp => emp.employeeId);
        
        while (existingIds.includes(finalId)) {
            currentSuffix++;
            finalId = `${prefix}${currentSuffix}`;
        }
        
        return finalId;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!firstName.trim() || !lastName.trim() || !joiningYear || !phone.trim()) {
            setStatusMessage({ text: 'All fields (Name, Phone, Year) are compulsory', type: 'error' });
            return;
        }

        if (!isValidPhone(phone)) {
            setStatusMessage({ text: 'Phone number must be exactly 10 digits', type: 'error' });
            return;
        }

        const fullName = `${firstName.trim().toUpperCase()} ${lastName.trim().toUpperCase()}`;
        const finalRole = role === 'OTHER' ? customRole.trim().toUpperCase() : role;

        if (role === 'OTHER' && !customRole.trim()) {
            setStatusMessage({ text: 'Please specify the role', type: 'error' });
            return;
        }
        
        try {
            if (editingEmployee) {
                const updatedEmployee = {
                    ...editingEmployee,
                    name: fullName,
                    firstName: firstName.trim().toUpperCase(),
                    lastName: lastName.trim().toUpperCase(),
                    phone: phone.trim(),
                    joiningYear: parseInt(joiningYear, 10),
                    role: finalRole,
                    lastUpdated: serverTimestamp()
                };
                await setDoc(doc(db, 'employees', editingEmployee.employeeId), updatedEmployee);
                setStatusMessage({ text: `Employee ${editingEmployee.employeeId} updated!`, type: 'success' });
            } else {
                const empId = generateUniqueId(fullName, joiningYear, employees);
                const newEmployee = {
                    name: fullName,
                    firstName: firstName.trim().toUpperCase(),
                    lastName: lastName.trim().toUpperCase(),
                    phone: phone.trim(),
                    joiningYear: parseInt(joiningYear, 10),
                    employeeId: empId,
                    role: finalRole,
                    timestamp: serverTimestamp()
                };
                await setDoc(doc(db, 'employees', empId), newEmployee);
                setLastRegistered(newEmployee);
                handleShareRegistration(newEmployee, true);
                setStatusMessage({ text: `Employee registered! ID: ${empId}`, type: 'success' });
            }
            resetForm();
            setIsFormOpen(false);
        } catch (error) {
            console.error("Error saving employee: ", error);
            setStatusMessage({ text: 'Error saving employee', type: 'error' });
        }
    };

    const resetForm = () => {
        setFirstName('');
        setLastName('');
        setPhone('');
        setJoiningYear(new Date().getFullYear().toString());
        setRole('KATA');
        setCustomRole('');
        setEditingEmployee(null);
    };

    const handleEdit = (emp) => {
        setEditingEmployee(emp);
        setFirstName(emp.firstName || '');
        setLastName(emp.lastName || '');
        setPhone(emp.phone || '');
        setJoiningYear(emp.joiningYear?.toString() || new Date().getFullYear().toString());
        
        // Map old roles to new ones for backward compatibility
        let currentRole = emp.role || 'KATA';
        const normalizedRole = currentRole.toUpperCase();
        if (normalizedRole === 'ADMIN') {
            setRole('ADMIN');
            setCustomRole('');
        } else if (normalizedRole === 'CASHIER') {
            setRole('CASHIER');
            setCustomRole('');
        } else if (normalizedRole === 'KATA' || normalizedRole === 'STAFF') {
            setRole('KATA');
            setCustomRole('');
        } else {
            setRole('OTHER');
            setCustomRole(currentRole);
        }
        
        setIsFormOpen(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id, role) => {
        if (id === 'ADMIN') {
            setStatusMessage({ text: 'Cannot delete Super Admin account', type: 'error' });
            setDeleteConfirmId(null);
            return;
        }
        try {
            await deleteDoc(doc(db, 'employees', id));
            setDeleteConfirmId(null);
            setStatusMessage({ text: 'Employee deleted successfully', type: 'success' });
        } catch (error) {
            console.error("Error deleting employee: ", error);
            setStatusMessage({ text: 'Error deleting employee', type: 'error' });
        }
    };

    const handleShareRegistration = (emp, isFirstTime = false) => {
        let message = '';
        
        if (isFirstTime) {
            message = `*VENKATESH COTTON COMPANY*\n\n` +
                `Hello *${emp.name}*,\n` +
                `Your registration is successful!\n\n` +
                `*Employee ID:* ${emp.employeeId}\n` +
                `*Role:* ${emp.role}\n` +
                `*Joining Year:* ${emp.joiningYear}\n\n` +
                `Welcome to the team!`;
        } else {
            message = `Hello ${emp.name},\n` +
                `On your Request The Details have been sent to you\n\n` +
                `Employee ID: ${emp.employeeId}\n` +
                `Role: ${emp.role}\n` +
                `Joining Year: ${emp.joiningYear}\n\n` +
                `Thankyou !!`;
        }
        
        let cleanPhone = emp.phone.replace(/\D/g, '');
        // If it's a 10-digit number, prepend 91 (India country code)
        if (cleanPhone.length === 10) {
            cleanPhone = '91' + cleanPhone;
        }
        
        const encodedMsg = encodeURIComponent(message);
        const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMsg}`;
        window.open(whatsappUrl, '_blank');
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Employee List</h2>
                <div className="flex items-center gap-4">
                    {statusMessage.text && (
                        <div className={`px-4 py-2 rounded-lg text-sm font-bold animate-in fade-in slide-in-from-right-4 ${
                            statusMessage.type === 'success' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                            {statusMessage.text}
                        </div>
                    )}
                    {isAdmin && (
                        <button 
                            onClick={() => {
                                if (isFormOpen) resetForm();
                                setIsFormOpen(!isFormOpen);
                            }} 
                            className="btn-primary flex items-center gap-2"
                        >
                            {isFormOpen ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                            {isFormOpen ? 'Close Form' : 'Add New Employee'}
                        </button>
                    )}
                </div>
            </div>

            {isFormOpen && isAdmin && (
                <div className="card animate-in fade-in slide-in-from-top-4 duration-300">
                    <h3 className="text-lg font-bold mb-6 text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                        {editingEmployee ? `Edit Employee: ${editingEmployee.employeeId}` : 'Register New Employee'}
                    </h3>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">First Name</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
                                <input 
                                    type="text" 
                                    className="input-field pl-10 uppercase dark:bg-slate-800 dark:border-slate-700 dark:text-white" 
                                    value={firstName} 
                                    onChange={(e) => setFirstName(e.target.value.toUpperCase())} 
                                    required 
                                    placeholder="E.G., SHIVANAND"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Last Name</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
                                <input 
                                    type="text" 
                                    className="input-field pl-10 uppercase dark:bg-slate-800 dark:border-slate-700 dark:text-white" 
                                    value={lastName} 
                                    onChange={(e) => setLastName(e.target.value.toUpperCase())} 
                                    required 
                                    placeholder="E.G., SHINDE"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Phone Number</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
                                <input 
                                    type="tel" 
                                    className={`input-field pl-10 dark:bg-slate-800 dark:text-white ${phone && !isValidPhone(phone) ? 'border-red-500 dark:border-red-500 focus:ring-red-500 focus:border-red-500' : 'dark:border-slate-700'}`}
                                    value={phone} 
                                    onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))} 
                                    required 
                                    pattern="^[0-9]{10}$"
                                    title="Enter a valid 10-digit phone number"
                                    maxLength={10}
                                    placeholder="e.g., 9876543210"
                                />
                            </div>
                            {phone && !isValidPhone(phone) && (
                                <p className="text-[10px] font-bold text-red-500 uppercase tracking-wide">Enter a valid 10-digit phone number</p>
                            )}
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Year of Joining</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
                                <input 
                                    type="number" 
                                    className="input-field pl-10 dark:bg-slate-800 dark:border-slate-700 dark:text-white" 
                                    value={joiningYear} 
                                    onChange={(e) => setJoiningYear(e.target.value)} 
                                    required 
                                    min="2000" 
                                    max="2099"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Role / Access Level</label>
                            <div className="relative">
                                <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
                                <select 
                                    className="input-field pl-10 uppercase font-bold dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    value={role}
                                    onChange={(e) => setRole(e.target.value)}
                                    required
                                >
                                    <option value="ADMIN">ADMIN (FULL CONTROL)</option>
                                    <option value="CASHIER">CASHIER</option>
                                    <option value="KATA">KATA</option>
                                    <option value="OTHER">OTHER (SPECIFY)</option>
                                </select>
                            </div>
                        </div>
                        {role === 'OTHER' && (
                            <div className="space-y-1 animate-in fade-in slide-in-from-left-2 duration-200">
                                <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Specify Role</label>
                                <div className="relative">
                                    <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
                                    <input 
                                        type="text" 
                                        className="input-field pl-10 uppercase font-bold dark:bg-slate-800 dark:border-slate-700 dark:text-white" 
                                        value={customRole} 
                                        onChange={(e) => setCustomRole(e.target.value.toUpperCase())} 
                                        required 
                                        placeholder="E.G., DRIVER, MOISTURE CHECKER"
                                    />
                                </div>
                            </div>
                        )}
                        <div className="md:col-span-2 flex justify-end gap-3 pt-4 border-t border-slate-100">
                            {editingEmployee && (
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        resetForm();
                                        setIsFormOpen(false);
                                    }} 
                                    className="btn-secondary"
                                >
                                    Cancel
                                </button>
                            )}
                            <button type="submit" className="btn-primary">
                                {editingEmployee ? 'Update Details' : 'Generate ID & Save'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Registration Success Modal */}
            {lastRegistered && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 text-center space-y-6">
                            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto">
                                <CheckCircle2 className="w-12 h-12 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Registration Successful!</h3>
                                <p className="text-slate-600 dark:text-slate-400 font-medium">
                                    Employee ID generated: <span className="font-black text-indigo-600 dark:text-indigo-400">{lastRegistered.employeeId}</span>
                                </p>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-3 text-left">
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-400 uppercase font-bold">Name</span>
                                    <span className="text-slate-900 dark:text-white font-black">{lastRegistered.name}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-400 uppercase font-bold">Role</span>
                                    <span className="text-slate-900 dark:text-white font-black">{lastRegistered.role}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-400 uppercase font-bold">Phone</span>
                                    <span className="text-slate-900 dark:text-white font-black">{lastRegistered.phone}</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    onClick={() => setLastRegistered(null)}
                                    className="py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-black rounded-2xl transition-all uppercase tracking-widest text-xs"
                                >
                                    Close
                                </button>
                                <button 
                                    onClick={() => handleShareRegistration(lastRegistered, true)}
                                    className="py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-emerald-200 dark:shadow-none flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                                >
                                    <Share2 className="w-4 h-4" /> Send SMS/WA
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="card overflow-hidden !p-0">
                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                    {employees.map(emp => (
                        <div key={emp.id} className="p-4 space-y-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase leading-tight">{emp.name}</h4>
                                    <div className="text-[10px] text-indigo-500 font-mono font-bold mt-0.5">{emp.employeeId}</div>
                                </div>
                                <div className="flex gap-1">
                                    <button 
                                        onClick={() => handleShareRegistration(emp, false)}
                                        className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400"
                                    >
                                        <Share2 className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => handleEdit(emp)}
                                        className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-indigo-600 dark:text-indigo-400"
                                    >
                                        <ShieldCheck className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => setDeleteConfirmId(emp.id)}
                                        className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Phone</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300 font-mono">{emp.phone || 'N/A'}</span>
                                        {emp.phone && (
                                            <a 
                                                href={`tel:${emp.phone}`}
                                                className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full hover:bg-emerald-200 transition-colors"
                                                title="Call Employee"
                                            >
                                                <Phone className="w-4 h-4" />
                                            </a>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Role</p>
                                    <span className={`inline-block px-2 py-0.5 mt-1 rounded text-[10px] font-black uppercase ${
                                        emp.role?.toUpperCase() === 'ADMIN' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                    }`}>
                                        {emp.role || 'KATA'}
                                    </span>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Joined</p>
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{emp.joiningYear}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                                <th className="px-6 py-4 font-semibold">Employee Name</th>
                                <th className="px-6 py-4 font-semibold">Phone Number</th>
                                <th className="px-6 py-4 font-semibold text-center">Role</th>
                                <th className="px-6 py-4 font-semibold">Year of Joining</th>
                                {isAdmin && <th className="px-6 py-4 font-semibold text-right">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {employees.map(emp => (
                                <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-slate-100 uppercase">
                                        <div className="flex flex-col">
                                            <span>{emp.name}</span>
                                            {isAdmin && <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-mono">{emp.employeeId}</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-600 dark:text-slate-400 font-medium font-mono">{emp.phone || 'N/A'}</span>
                                            {emp.phone && (
                                                <a 
                                                    href={`tel:${emp.phone}`}
                                                    className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-200 transition-colors"
                                                    title="Call Employee"
                                                >
                                                    <Phone className="w-3 h-3" />
                                                </a>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                                            emp.role?.toUpperCase() === 'ADMIN' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                        }`}>
                                            {emp.role?.toUpperCase() === 'STAFF' ? 'KATA' : (emp.role || 'KATA')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{emp.joiningYear}</td>
                                    {isAdmin && (
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button 
                                                    onClick={() => handleShareRegistration(emp, false)}
                                                    className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"
                                                    title="Share Registration"
                                                >
                                                    <Share2 className="w-5 h-5" />
                                                </button>
                                                <button 
                                                    onClick={() => handleEdit(emp)}
                                                    className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                                                    title="Edit Employee"
                                                >
                                                    <ShieldCheck className="w-5 h-5" />
                                                </button>
                                                {deleteConfirmId === emp.id ? (
                                                    <div className="flex justify-end gap-2 animate-in zoom-in-95 duration-200">
                                                        <button 
                                                            onClick={() => handleDelete(emp.id, emp.role)}
                                                            className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded hover:bg-red-700 transition-colors"
                                                        >
                                                            Confirm
                                                        </button>
                                                        <button 
                                                            onClick={() => setDeleteConfirmId(null)}
                                                            className="px-3 py-1 bg-slate-200 text-slate-700 text-xs font-bold rounded hover:bg-slate-300 transition-colors"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button 
                                                        onClick={() => setDeleteConfirmId(emp.id)}
                                                        className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                                                        title="Delete Employee"
                                                    >
                                                        <Trash2 className="w-5 h-5" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default Employees;