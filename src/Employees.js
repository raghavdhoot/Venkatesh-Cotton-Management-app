import React, { useState, useEffect } from 'react';
import { db } from './firebaseConfig';
import { collection, onSnapshot, query, orderBy, serverTimestamp, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { UserPlus, Trash2, User, Calendar, ShieldCheck, Phone, X } from 'lucide-react';

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

    const isAdmin = currentUser?.role?.toUpperCase() === 'ADMIN' || currentUser?.employeeId === 'ADMIN';

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
                                    className="input-field pl-10 dark:bg-slate-800 dark:border-slate-700 dark:text-white" 
                                    value={phone} 
                                    onChange={(e) => setPhone(e.target.value)} 
                                    required 
                                    placeholder="e.g., 9876543210"
                                />
                            </div>
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

            <div className="card overflow-hidden !p-0">
                <div className="overflow-x-auto">
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
                                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 font-medium">{emp.phone || 'N/A'}</td>
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
