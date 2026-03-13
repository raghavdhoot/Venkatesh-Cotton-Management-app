import React, { useState, useEffect } from 'react';
import { db } from './firebaseConfig';
import { collection, onSnapshot, query, orderBy, serverTimestamp, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { UserPlus, Trash2, User, Calendar, ShieldCheck, Phone } from 'lucide-react';

function Employees({ currentUser }) {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');
    const [joiningYear, setJoiningYear] = useState(new Date().getFullYear().toString());
    const [employees, setEmployees] = useState([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });

    const isAdmin = currentUser?.role === 'admin' || currentUser?.employeeId === 'ADMIN';

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
                .filter(emp => emp.employeeId !== 'ADMIN' && emp.role !== 'admin');
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

        const fullName = `${firstName.trim()} ${lastName.trim()}`;
        const empId = generateUniqueId(fullName, joiningYear, employees);
        
        const newEmployee = {
            name: fullName,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            phone: phone.trim(),
            joiningYear: parseInt(joiningYear, 10),
            employeeId: empId,
            role: 'staff', // Default role
            timestamp: serverTimestamp()
        };

        try {
            await setDoc(doc(db, 'employees', empId), newEmployee);
            setFirstName('');
            setLastName('');
            setPhone('');
            setJoiningYear(new Date().getFullYear().toString());
            setIsFormOpen(false);
            setStatusMessage({ text: `Employee registered! ID: ${empId}`, type: 'success' });
        } catch (error) {
            console.error("Error adding employee: ", error);
            setStatusMessage({ text: 'Error adding employee', type: 'error' });
        }
    };

    const handleDelete = async (id, role) => {
        if (role === 'admin' || id === 'ADMIN') {
            setStatusMessage({ text: 'Cannot delete Admin accounts', type: 'error' });
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
                <h2 className="text-2xl font-bold text-slate-900">Employee List</h2>
                <div className="flex items-center gap-4">
                    {statusMessage.text && (
                        <div className={`px-4 py-2 rounded-lg text-sm font-bold animate-in fade-in slide-in-from-right-4 ${
                            statusMessage.type === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>
                            {statusMessage.text}
                        </div>
                    )}
                    {isAdmin && (
                        <button 
                            onClick={() => setIsFormOpen(!isFormOpen)} 
                            className="btn-primary flex items-center gap-2"
                        >
                            {isFormOpen ? <ShieldCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                            {isFormOpen ? 'Close Form' : 'Add New Employee'}
                        </button>
                    )}
                </div>
            </div>

            {isFormOpen && isAdmin && (
                <div className="card animate-in fade-in slide-in-from-top-4 duration-300">
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600">First Name</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input 
                                    type="text" 
                                    className="input-field pl-10" 
                                    value={firstName} 
                                    onChange={(e) => setFirstName(e.target.value)} 
                                    required 
                                    placeholder="e.g., Shivanand"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600">Last Name</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input 
                                    type="text" 
                                    className="input-field pl-10" 
                                    value={lastName} 
                                    onChange={(e) => setLastName(e.target.value)} 
                                    required 
                                    placeholder="e.g., Shinde"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600">Phone Number</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input 
                                    type="tel" 
                                    className="input-field pl-10" 
                                    value={phone} 
                                    onChange={(e) => setPhone(e.target.value)} 
                                    required 
                                    placeholder="e.g., 9876543210"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600">Year of Joining</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input 
                                    type="number" 
                                    className="input-field pl-10" 
                                    value={joiningYear} 
                                    onChange={(e) => setJoiningYear(e.target.value)} 
                                    required 
                                    min="2000" 
                                    max="2099"
                                />
                            </div>
                        </div>
                        <div className="md:col-span-2 flex justify-end gap-3 pt-4 border-t border-slate-100">
                            <button type="submit" className="btn-primary">Generate ID & Save</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="card overflow-hidden !p-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                                <th className="px-6 py-4 font-semibold">Employee Name</th>
                                <th className="px-6 py-4 font-semibold">Year of Joining</th>
                                {isAdmin && <th className="px-6 py-4 font-semibold text-right">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {employees.map(emp => (
                                <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                                        <div className="flex flex-col">
                                            <span>{emp.name}</span>
                                            {isAdmin && <span className="text-[10px] text-indigo-500 font-mono">{emp.employeeId}</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">{emp.joiningYear}</td>
                                    {isAdmin && (
                                        <td className="px-6 py-4 text-right">
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
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            )}
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
